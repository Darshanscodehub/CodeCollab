// Import required modules
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });console.log('JWT_SECRET is:', process.env.JWT_SECRET);
const JWT_SECRET = process.env.JWT_SECRET;
const mongo_uri = process.env.MONGO_URI

const express = require('express');  // For creating our web server
const http = require('http');        // Required to run Socket.IO with Express
const { Server } = require('socket.io'); // For real-time communication
const cors = require('cors');        // To allow frontend to connect
// const Docker = require('dockerode');
// const docker = new Docker({ socketPath: '/var/run/docker.sock' }); 
const { exec } = require('child_process');
const fs = require('fs');
const mongoose = require('mongoose');
const CodeSnippet = require('./models/CodeSnippet'); // Import the model
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const authenticateUser = require('./middlewares/authMiddleware');


// Create an Express app
const app = express();
app.use(cors());  // Enable CORS
app.use(express.json());

//MongoDB connection
mongoose.connect(mongo_uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));


// Create an HTTP server using Express
const server = http.createServer(app);
// Attach Socket.IO to the server
const io = new Server(server, {
    cors: {
        origin: "*", // your frontend URL
        methods: ["GET", "POST"]
    }
});



// Force landing.html as default
app.get('/', (req, res) => {
res.sendFile(path.join(__dirname, '..', 'frontend', 'landing.html'));
});
// Serve frontend folder as static files
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Routes for other pages
app.get('/editor', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'login.html'));
});

app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'signup.html'));
});

// Store code in memory (for now)
let codeContent = "// Start coding here...\n";

// Store code per room in memory
let roomCodes = {};

// In backend/server.js

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // When a user joins a room
    socket.on('join-room', (roomId) => {
        socket.join(roomId);
        console.log(`User ${socket.id} joined room: ${roomId}`);

        // Get the current code for the room, or a default
        const currentCode = roomCodes[roomId] || "// Welcome! Waiting for code sync...\n";
        
        // Immediately send the current server-side code to the new user
        socket.emit('load-code', currentCode);

        // Notify OTHERS in the room that a new user has joined
        socket.broadcast.to(roomId).emit('user-joined', { socketId: socket.id });
    });

    // When an existing user is asked to sync code with a new user
    socket.on('sync-code', ({ code, toSocketId }) => {
        // Send the code only to the new user
        io.to(toSocketId).emit('load-code', code);
    });

    // When a user types, broadcast the changes
    socket.on('code-change', (data) => {
        if (data.roomId && data.code) {
            roomCodes[data.roomId] = data.code; // Keep the server's version up to date
            socket.broadcast.to(data.roomId).emit('code-change', data.code);
        }
    });

    // Handle user disconnection
    socket.on('disconnect', () => {
        console.log('A user disconnected:', socket.id);
    });
});

// Compile & run code endpoint
// Compile & run code endpoint
app.post('/run', (req, res) => {
    const { code, language } = req.body;

    if (!code) {
        return res.status(400).json({ output: 'No code provided.' });
    }

    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    // Use a unique filename to avoid race conditions if multiple users run code simultaneously
    const uniqueId = Date.now() + '-' + Math.random().toString(36).substring(2, 8);
    let filePath;
    let command;
    const cleanupFiles = [];

    const getFilePath = (extension) => {
        const p = path.join(tempDir, `${uniqueId}.${extension}`);
        cleanupFiles.push(p);
        return p;
    };

    switch (language) {
        case 'javascript':
            filePath = getFilePath('js');
            fs.writeFileSync(filePath, code);
            command = `node ${filePath}`;
            break;

        case 'python':
            filePath = getFilePath('py');
            fs.writeFileSync(filePath, code);
            command = `python ${filePath}`;
            break;

        case 'c':
            filePath = getFilePath('c');
            const executablePathC = path.join(tempDir, `${uniqueId}.out`);
            cleanupFiles.push(executablePathC);
            fs.writeFileSync(filePath, code);
            command = `gcc ${filePath} -o ${executablePathC} && ${executablePathC}`;
            break;

        case 'cpp':
            filePath = getFilePath('cpp');
            const executablePathCpp = path.join(tempDir, `${uniqueId}.out`);
            cleanupFiles.push(executablePathCpp);
            fs.writeFileSync(filePath, code);
            command = `g++ ${filePath} -o ${executablePathCpp} && ${executablePathCpp}`;
            break;

        default:
            return res.status(400).json({ output: 'Unsupported language' });
    }

    const execTimeout = 10000; // 10 seconds timeout

    exec(command, { timeout: execTimeout }, (error, stdout, stderr) => {
        // Cleanup the temporary files
        cleanupFiles.forEach(file => {
            if (fs.existsSync(file)) {
                fs.unlinkSync(file);
            }
        });

        if (error) {
            // Check for timeout error
            if (error.signal === 'SIGTERM') {
                return res.json({ output: 'Execution timed out. Your code took too long to run.' });
            }
            // Other execution errors
            return res.json({ output: stderr || error.message });
        }
        res.json({ output: stdout });
    });
});




// Save code snippet (POST /snippets)
app.post('/snippets', authenticateUser, async (req, res) => {
    try {
        // Accept both old and new field names to be forgiving
        const title = req.body.title || req.body.name;
        const code = req.body.code || req.body.content;
        const language = req.body.language || req.body.lang;
        const folder = req.body.folder || 'root';

        if (!title || !code || !language) {
            return res.status(400).json({ message: 'All fields are required: title, code, language' });
        }

        const snippet = new CodeSnippet({
            title,
            code,
            language,
            userId: req.user.userId, // from JWT
            folder
        });

        await snippet.save();

        res.json({ message: 'Snippet saved successfully!', snippetId: snippet._id });
    } catch (err) {
        res.status(500).json({ message: 'Error saving snippet: ' + err.message });
    }
});

// Get one snippet (owner only)
app.get('/snippets/:id', authenticateUser, async (req, res) => {
    try {
        const snippet = await CodeSnippet.findById(req.params.id);
        if (!snippet) return res.status(404).json({ message: 'Snippet not found' });

        // only owner can get (for now)
        if (snippet.userId && snippet.userId.toString() !== req.user.userId) {
            return res.status(403).json({ message: 'Forbidden' });
        }

        res.json(snippet);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get all user's folders with files
app.get('/files', authenticateUser, async (req, res) => {
  try {
    // Find all snippets owned by this user
    const snippets = await CodeSnippet.find({ userId: req.user.userId });

    // Group snippets by folder name
    const foldersMap = {};

    snippets.forEach(snippet => {
      const folderName = snippet.folder || 'Default';
      if (!foldersMap[folderName]) {
        foldersMap[folderName] = [];
      }
      foldersMap[folderName].push({
        id: snippet._id,
        title: snippet.title,
        language: snippet.language
      });
    });

    // Convert map to array format
    const foldersArray = Object.entries(foldersMap).map(([folder, files]) => ({
      folder,
      files
    }));

    res.json(foldersArray);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching files: ' + err.message });
  }
});


//get all snippets
app.get('/snippets', authenticateUser, async (req, res) => {
    try {
        const { folder } = req.query;
        const filter = { userId: req.user.userId };
        if (folder) filter.folder = folder;


        const snippets = await CodeSnippet.find(filter).sort({ createdAt: -1 });
        res.json(snippets);
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});


// Signup
app.post('/signup', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ message: "All fields required" });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: "Email already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ name, email, password: hashedPassword });
        await user.save();

        res.json({ message: "Signup successful!" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Login
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: "User not found" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Invalid credentials" });
        }

        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '1h' });
        res.json({
            message: "Login successful",
            token,
            user: {
                name: user.name,
                email: user.email,
                _id: user._id
            }
        });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// This route to serve the dashboard page
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'dashboard.html'));
});

// Manages folders
app.post('/folders', authenticateUser, async (req, res) => {
    try {
        const { folderName } = req.body;
        if (!folderName) {
            return res.status(400).json({ message: "Folder name is required." });
        }

        // Create a placeholder snippet in the new folder
        const snippet = new CodeSnippet({
            title: 'Untitled',
            code: '// Start coding here...',
            language: 'javascript',
            userId: req.user.userId,
            folder: folderName
        });

        await snippet.save();
        res.status(201).json({ message: 'Folder created successfully!', folderName });
    } catch (err) {
        res.status(500).json({ message: 'Error creating folder: ' + err.message });
    }
});

// NEW: Delete a snippet
app.delete('/snippets/:id', authenticateUser, async (req, res) => {
    try {
        const snippet = await CodeSnippet.findById(req.params.id);

        if (!snippet) {
            return res.status(404).json({ message: "Snippet not found." });
        }

        // Security check: Only the owner can delete the snippet
        if (snippet.userId.toString() !== req.user.userId) {
            return res.status(403).json({ message: "Forbidden: You do not have permission to delete this snippet." });
        }

        await CodeSnippet.findByIdAndDelete(req.params.id);
        res.json({ message: "Snippet deleted successfully." });
    } catch (err) {
        res.status(500).json({ message: "Error deleting snippet: " + err.message });
    }
});

// NEW: Update a snippet (used for renaming or moving)
app.put('/snippets/:id', authenticateUser, async (req, res) => {
    try {
        const { title, folder } = req.body;
        const snippetId = req.params.id;

        if (!title && !folder) {
            return res.status(400).json({ message: "No fields to update provided." });
        }

        const snippet = await CodeSnippet.findById(snippetId);
        if (!snippet) {
            return res.status(404).json({ message: "Snippet not found." });
        }

        // Security check: Only the owner can modify the snippet
        if (snippet.userId.toString() !== req.user.userId) {
            return res.status(403).json({ message: "Forbidden: You do not have permission to modify this snippet." });
        }

        // Update the fields if they are provided
        if (title) {
            snippet.title = title;
        }
        if (folder) {
            snippet.folder = folder;
        }

        await snippet.save();
        res.json({ message: "Snippet updated successfully.", snippet });
    } catch (err) {
        res.status(500).json({ message: "Error updating snippet: " + err.message });
    }
});


// Start the server
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
