// Import required modules
require('dotenv').config();
console.log('JWT_SECRET is:', process.env.JWT_SECRET);
const JWT_SECRET = process.env.JWT_SECRET;
const mongo_uri = process.env.MONGO_URI

const express = require('express');  // For creating our web server
const http = require('http');        // Required to run Socket.IO with Express
const { Server } = require('socket.io'); // For real-time communication
const cors = require('cors');        // To allow frontend to connect
const Docker = require('dockerode');
const docker = new Docker({ socketPath: '/var/run/docker.sock' }); 
const mongoose = require('mongoose');
const CodeSnippet = require('./models/CodeSnippet'); // Import the model
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const path = require('path');
const authenticateUser = require('../middlewares/authMiddleware');


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

io.on('connection', (socket) => {
    console.log('A user connected');

    // Join a room
    socket.on('join-room', (roomId) => {
        socket.join(roomId);
        console.log(`User joined room: ${roomId}`);

        // Send existing code for this room or default code
        if (!roomCodes[roomId]) {
            roomCodes[roomId] = "// Start coding in your new room...\n";
        }
        socket.emit('load-code', roomCodes[roomId]);
    });

    // Handle code changes in a room
    socket.on('code-change', (data) => {
        if (data.roomId) {
            roomCodes[data.roomId] = data.code;
            socket.to(data.roomId).emit('code-change', data.code);
        } else {
            // fallback for no-room scenario (single shared editor)
            codeContent = data;
            socket.broadcast.emit('code-change', data);
        }
    });

    socket.on('disconnect', () => {
        console.log('A user disconnected');
    });
});


// Compile & run code endpoint
app.post('/run', async (req, res) => {
    const { code, language } = req.body;
    let image, cmd;

    const fs = require('fs');
    const path = require('path');
    const fileName = language === 'c' ? 'main.c' : language === 'cpp' ? 'main.cpp' : 'script.txt';
    const filePath = path.join(__dirname, 'temp', fileName);
    fs.writeFileSync(filePath, code);


    switch (language) {
        case 'javascript':
            image = 'node:18';
            cmd = ['node', '-e', code];
            break;
        case 'python':
            image = 'python:3.11';
            cmd = ['python', '-c', code];
            break;
        case 'c':
            image = 'gcc:latest';
           cmd = ['sh', '-c', 'gcc /code/main.c -o /code/main && /code/main'];
    break;
        case 'cpp':
            image = 'gcc:latest';
            cmd = ['sh', '-c', 'g++ /code/main.cpp -o /code/main && /code/main'];
    break
        default:
            return res.json({ output: 'Unsupported language' });
    }

    try {
        // Pull image if missing
        const images = await docker.listImages();
        if (!images.some(img => img.RepoTags && img.RepoTags.includes(image))) {
            await docker.pull(image);
        }

        // Create container
        const container = await docker.createContainer({
    Image: image,
    Cmd: cmd,
    AttachStdout: true,
    AttachStderr: true,
    HostConfig: {
        AutoRemove: true,
        Binds: [`${process.cwd()}/temp:/code`], // mount host folder
    }
});

        const stream = await container.attach({ stream: true, stdout: true, stderr: true });
        let output = '';
        stream.on('data', chunk => { output += chunk.toString(); });

        await container.start();
        await container.wait();
        try {
    await container.remove({ force: true });
} catch (err) {
    console.log("Container removal error:", err.message);
}


        res.json({ output: output.trim() });
    } catch (err) {
        res.json({ output: 'Error: ' + err.message });
    }
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
