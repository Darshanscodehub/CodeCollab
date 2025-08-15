// models/CodeSnippet.js
const mongoose = require('mongoose');

const CodeSnippetSchema = new mongoose.Schema({
    title: String,
    code: String,
    language: String,
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    folder: { type: String, default: '/' }, // NEW: folder path or name
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('CodeSnippet', CodeSnippetSchema);
