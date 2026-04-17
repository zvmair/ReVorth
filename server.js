import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import session from 'express-session';
import bcrypt from 'bcrypt';
import { supabase } from './supabase.js';
import { analyzeImage } from './services/ai.js';
// import Stripe from 'stripe'; 
// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY); 

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(express.static(__dirname));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.json()); // to parse json body

// Session middleware for login cookies
app.use(session({
    secret: 'revorth_super_secret_key_123',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // In production we need https for true
}));

const upload = multer({ storage: multer.memoryStorage() });

// --- AUTHENTICATION ROUTES ---

app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({error: "Username and password required"});
    
    try {
        const hash = await bcrypt.hash(password, 10);
        
        const { data, error } = await supabase
            .from('users')
            .insert([{ username, password_hash: hash }])
            .select()
            .single();

        if (error) {
            if (error.code === '23505') { // Unique violation in Postgres
                return res.status(400).json({error: "Username already exists."});
            }
            throw error;
        }
        
        req.session.userId = data.id;
        res.json({ success: true, message: "Account created! You have 5 free scans." });
    } catch (e) {
        console.error('Registration error:', e);
        res.status(500).json({error: "Registration failed."});
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    
    const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .maybeSingle();
    
    if (user && await bcrypt.compare(password, user.password_hash)) {
        req.session.userId = user.id;
        res.json({ success: true, available_scans: user.available_scans, role: user.role });
    } else {
        res.status(401).json({ error: "Invalid credentials" });
    }
});

app.get('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

app.get('/api/me', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({error: "Not logged in"});
    
    const { data: user, error } = await supabase
        .from('users')
        .select('username, available_scans, role')
        .eq('id', req.session.userId)
        .single();

    if (error) return res.status(404).json({error: "User not found"});
    res.json(user);
});

// --- SCANNING & LIMITS ---

app.post('/api/analyze', upload.array('images', 5), async (req, res) => {
    try {
        // Get logged-in user if session exists
        let user = null;
        if (req.session.userId) {
            const { data } = await supabase
                .from('users')
                .select('*')
                .eq('id', req.session.userId)
                .single();
            user = data;
        }

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No images uploaded' });
        }
        
        const timezone = req.body.timezone || 'UTC';
        const displayName = user ? user.username : 'guest';
        console.log(`User ${displayName} analyzing ${req.files.length} images. Timezone: ${timezone}`);
        
        const result = await analyzeImage(req.files, timezone);

        // Save the first image to uploads folder
        let savedImagePath = null;
        if (req.files && req.files.length > 0) {
            const uploadDir = path.join(__dirname, 'uploads');
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }
            const fileName = `scan-${Date.now()}-${Math.floor(Math.random() * 1000)}.jpg`;
            const filePath = path.join(uploadDir, fileName);
            fs.writeFileSync(filePath, req.files[0].buffer);
            savedImagePath = `/uploads/${fileName}`;
        }

        // Only save history and deduct scans if a real user is logged in
        if (user && user.id) {
            // Deduct 1 scan if not admin
            if (user.role !== 'admin') {
                await supabase
                    .from('users')
                    .update({ available_scans: user.available_scans - 1 })
                    .eq('id', user.id);
            }

            // Save to History Database - Use lowercase column names for PostgreSQL
            const { error: insertError } = await supabase
                .from('scans')
                .insert([{
                    user_id: user.id,
                    brand: result.brand,
                    type: result.type,
                    auth_score: result.authScore,
                    rarity_stars: result.rarityStars,
                    original_price: result.originalPrice,
                    thrift_price: result.thriftPrice,
                    market_links: JSON.stringify(result.marketLinks),
                    era: result.era,
                    history: result.history,
                    auth_tips: result.authTips,
                    image_path: savedImagePath
                }]);
            
            if (insertError) console.error('History save error:', insertError);
        }

        res.json({ ...result, scans_left: 'unlimited' });
    } catch (error) {
        console.error('Analysis error:', error);
        const status = error.status || 500;
        res.status(status).json({ error: error.message });
    }
});

// --- HISTORY FETCHING ---
app.get('/api/history', async (req, res) => {
    let userId = req.session.userId;
    
    if (!userId) {
        // Fallback for demo if no session: get the first user
        const { data: firstUser } = await supabase
            .from('users')
            .select('id')
            .limit(1)
            .maybeSingle();
        
        if (firstUser) userId = firstUser.id;
        else return res.json([]);
    }

    const { data: scans, error } = await supabase
        .from('scans')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('History fetch error:', error);
        return res.json([]);
    }
    
    // Map snake_case database columns back to camelCase for the frontend
    const mappedScans = scans.map(s => ({
        ...s,
        authScore: s.auth_score,
        rarityStars: s.rarity_stars,
        originalPrice: s.original_price,
        thriftPrice: s.thrift_price,
        marketLinks: s.market_links ? JSON.parse(s.market_links) : [],
        authTips: s.auth_tips
    }));

    res.json(mappedScans);
});


app.listen(port, () => {
    console.log(`ReVorth API and Web server running at http://localhost:${port}`);
});
