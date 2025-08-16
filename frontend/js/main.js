// frontend/js/main.js
// =============== config ===============
const API_BASE = 'https://darshan-codecollab-v1.onrender.com'; // change if your backend is elsewhere

// =============== globals ===============
const socket = io(API_BASE);
let editor;
let roomId = sessionStorage.getItem('roomId') || null;
const token = localStorage.getItem('token') || null;
const userData = JSON.parse(localStorage.getItem('user') || 'null');

// =============== helper: show avatar ===============
function updateAvatarUI() {
    const avatar = document.getElementById('user-initial');
    if (!avatar) return;
    if (token && userData && userData.name) {
        avatar.textContent = userData.name.charAt(0).toUpperCase();
        avatar.title = userData.name;
    } else {
        avatar.textContent = "?";
        avatar.title = "Not logged in";
    }
}

// =============== session/room display ===============
const sessionInfoSpan = document.querySelector('.session-info span');
function updateRoomDisplay() {
    if (!sessionInfoSpan) return;
    sessionInfoSpan.textContent = roomId ? roomId : "No Room";
}
if (sessionInfoSpan) {
    sessionInfoSpan.addEventListener('click', () => {
        if (roomId) {
            navigator.clipboard.writeText(roomId);
            sessionInfoSpan.textContent = "Copied!";
            setTimeout(updateRoomDisplay, 1500);
        }
    });
}

// Fully updated function to load snippet by ID
async function loadSnippetById(snippetId) {
    try {
        console.log(`Loading snippet with ID: ${snippetId}`);

        if (!token) {
            alert("Please log in to load snippets.");
            return null;
        }

        const response = await fetch(`${API_BASE}/snippets/${snippetId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.status === 403) {
            alert("You don’t have permission to view this snippet.");
            return null;
        }
        
        if (!response.ok) {
            throw new Error(`Failed to load snippet: ${response.statusText}`);
        }

        const snippet = await response.json();

        if (!snippet) {
            console.error("No snippet data found for this ID.");
            return null;
        }
        
        if (typeof editor !== "undefined" && editor.setValue) {
            editor.setValue(snippet.code || "");
            
            if (typeof monaco !== "undefined" && snippet.language) {
                monaco.editor.setModelLanguage(editor.getModel(), snippet.language);
            }
        }
        
        if (document.getElementById("snippet-title")) {
            document.getElementById("snippet-title").textContent = snippet.title || "Untitled";
        }
        if (document.getElementById("folderName")) {
            document.getElementById("folderName").textContent = snippet.folder || "root";
        }
        if (document.getElementById("filenameInput")) {
            document.getElementById("filenameInput").value = snippet.title || "";
        }
        
        console.log("Snippet loaded successfully:", snippet);

        // Store both the snippet ID and the user ID
        localStorage.setItem('lastLoadedSnippetId', snippetId);
        if (userData && userData._id) {
            localStorage.setItem('lastLoadedUserId', userData._id);
        }

        return snippet;

    } catch (error) {
        console.error("Error loading snippet:", error);
        return null;
    }
}

// NEW: Function to render the in-editor file explorer
// async function renderInEditorFileExplorer() {
//     const fileExplorerContent = document.getElementById('file-explorer-content-editor');
//     if (!fileExplorerContent || !token) {
//         return;
//     }

//     try {
//         const response = await fetch(`${API_BASE}/files`, {
//             headers: { 'Authorization': `Bearer ${token}` }
//         });
//         if (!response.ok) { throw new Error('Failed to fetch files.'); }

//         const folders = await response.json();
//         fileExplorerContent.innerHTML = '';

//         if (folders.length === 0) {
//             fileExplorerContent.innerHTML = '<div style="padding:15px; color:var(--text-muted-color);">You have no files.</div>';
//             return;
//         }

//         folders.forEach(folderData => {
//             const folderContainer = document.createElement('div');
            
//             const folderHeader = document.createElement('div');
//             folderHeader.className = 'folder-item';
            
//             const folderIcon = document.createElement('span');
//             folderIcon.className = 'folder-icon';
//             folderIcon.innerHTML = '&#9654;';
//             folderHeader.appendChild(folderIcon);

//             const folderTitle = document.createElement('span');
//             folderTitle.textContent = folderData.folder;
//             folderHeader.appendChild(folderTitle);
            
//             folderContainer.appendChild(folderHeader);

//             const fileList = document.createElement('ul');
//             fileList.className = 'file-list';

//             folderData.files.forEach(file => {
//                 const fileItem = document.createElement('li');
//                 fileItem.className = 'file-item';
//                 fileItem.dataset.id = file.id;

//                 const fileActionsContainer = document.createElement('div');
//                 fileActionsContainer.className = 'file-actions-container';

//                 const fileIcon = document.createElement('span');
//                 fileIcon.innerHTML = '&#128196;';
//                 fileActionsContainer.appendChild(fileIcon);

//                 const fileTitleSpan = document.createElement('span');
//                 fileTitleSpan.textContent = file.title;
//                 fileActionsContainer.appendChild(fileTitleSpan);
                
//                 fileActionsContainer.addEventListener('click', () => {
//                     loadSnippetById(file.id);
//                 });
    
//                 fileItem.appendChild(fileActionsContainer);
//                 fileList.appendChild(fileItem);
//             });
            
//             folderContainer.appendChild(fileList);
//             fileExplorerContent.appendChild(folderContainer);
            
//             folderHeader.addEventListener('click', () => {
//                 folderHeader.classList.toggle('open');
//             });
//         });

//     } catch (error) {
//         console.error('Error fetching files:', error);
//         fileExplorerContent.innerHTML = '<div style="padding:15px; color:var(--text-muted-color);">Failed to load files.</div>';
//     }
// }

// NEW: Function to render the in-editor file explorer
async function renderInEditorFileExplorer() {
    const fileExplorerContent = document.getElementById('file-explorer-content-editor');
    if (!fileExplorerContent || !token) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/files`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) { throw new Error('Failed to fetch files.'); }

        const folders = await response.json();
        fileExplorerContent.innerHTML = '';

        if (folders.length === 0) {
            fileExplorerContent.innerHTML = '<div style="padding:15px; color:var(--text-muted-color);">You have no files.</div>';
            return;
        }

        folders.forEach(folderData => {
            const folderContainer = document.createElement('div');
            
            const folderHeader = document.createElement('div');
            folderHeader.className = 'folder-item';
            // folderHeader.classList.add('open'); // ADDED: Start folders as 'open' by default
            
            const folderIcon = document.createElement('span');
            folderIcon.className = 'folder-icon';
            folderIcon.innerHTML = '&#9654;';
            folderHeader.appendChild(folderIcon);

            const folderTitle = document.createElement('span');
            folderTitle.textContent = folderData.folder;
            folderHeader.appendChild(folderTitle);
            
            folderContainer.appendChild(folderHeader);

            const fileList = document.createElement('ul');
            fileList.className = 'file-list';

            folderData.files.forEach(file => {
                const fileItem = document.createElement('li');
                fileItem.className = 'file-item';
                fileItem.dataset.id = file.id;

                const fileActionsContainer = document.createElement('div');
                fileActionsContainer.className = 'file-actions-container';

                const fileIcon = document.createElement('span');
                fileIcon.innerHTML = '&#128196;';
                fileActionsContainer.appendChild(fileIcon);

                const fileTitleSpan = document.createElement('span');
                fileTitleSpan.textContent = file.title;
                fileActionsContainer.appendChild(fileTitleSpan);
                
                fileActionsContainer.addEventListener('click', () => {
                    loadSnippetById(file.id);
                });
    
                fileItem.appendChild(fileActionsContainer);
                fileList.appendChild(fileItem);
            });
            
            folderContainer.appendChild(fileList);
            fileExplorerContent.appendChild(folderContainer);
            
            folderHeader.addEventListener('click', () => {
                folderHeader.classList.toggle('open');
            });
        });

    } catch (error) {
        console.error('Error fetching files:', error);
        fileExplorerContent.innerHTML = '<div style="padding:15px; color:var(--text-muted-color);">Failed to load files.</div>';
    }
}
// NEW: Function to populate the folder dropdown in the save modal
async function populateFolderDropdown() {
    const dropdown = document.getElementById('save-folder-select');
    if (!dropdown || !token) return;

    try {
        const res = await fetch(`${API_BASE}/files`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) throw new Error('Failed to fetch folders.');
        const folders = await res.json();
        
        dropdown.innerHTML = '';
        folders.forEach(folderData => {
            const option = document.createElement('option');
            option.value = folderData.folder;
            option.textContent = folderData.folder;
            dropdown.appendChild(option);
        });

    } catch (error) {
        console.error('Error populating folders:', error);
    }
}

// NEW: Logout function to clear session data
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('lastLoadedSnippetId');
    localStorage.removeItem('lastLoadedUserId');
    window.location.href = '/login';
}

window.loadSnippetById = loadSnippetById;
window.renderInEditorFileExplorer = renderInEditorFileExplorer;
window.populateFolderDropdown = populateFolderDropdown;

// =============== DOM ready (init everything) ===============
document.addEventListener('DOMContentLoaded', () => {
    updateAvatarUI();
    updateRoomDisplay();

    // ensure required elements exist
    const createRoomBtn = document.getElementById('create-room-btn');
    const joinRoomBtn = document.getElementById('join-room-btn');
    const runBtn = document.getElementById('run-btn');
    const saveBtn = document.getElementById('save-btn');
    const loadBtn = document.getElementById('load-btn');
    const languageSelect = document.getElementById('language');
    const outputConsole = document.getElementById('output-console');
    const logoutBtn = document.getElementById('logout-btn');
    // NEW: Get the new file button and folder select element
    const newFileBtn = document.getElementById('new-file-btn');
    const saveFolderSelect = document.getElementById('save-folder-select');

    const saveModal = document.getElementById('save-modal-overlay');
    const loadModal = document.getElementById('load-modal-overlay');
    const confirmSaveBtn = document.getElementById('confirm-save-btn');
    const cancelSaveBtn = document.getElementById('cancel-save-btn');
    const cancelLoadBtn = document.getElementById('cancel-load-btn');
    const snippetList = document.getElementById('snippet-list');

    const mainContentArea = document.querySelector('.main-content-area');
    const outputWrapper = document.getElementById('output-wrapper');
    const toggleLeftBtn = document.getElementById('toggle-left-panel-btn');
    const toggleOutputBtn = document.getElementById('toggle-output-btn');

    // Monaco editor init (do this after DOM ready)
    require.config({ paths: { 'vs': 'https://unpkg.com/monaco-editor@latest/min/vs' }});
    require(['vs/editor/editor.main'], function () {
        editor = monaco.editor.create(document.getElementById('editor-container'), {
            value: "// Welcome to CodeCollab!\n",
            language: "javascript",
            theme: "vs-dark",
            fontFamily: "Fira Code",
            fontLigatures: true,
            automaticLayout: true
        });

        // NEW: Call the new file explorer function
        renderInEditorFileExplorer();

        const urlParams = new URLSearchParams(window.location.search);
        const fileIdFromUrl = urlParams.get('fileId');
        
        if (fileIdFromUrl) {
            loadSnippetById(fileIdFromUrl);
        } else {
            const lastSnippetId = localStorage.getItem('lastLoadedSnippetId');
            const lastLoadedUserId = localStorage.getItem('lastLoadedUserId');
            if (lastSnippetId && token && userData && lastLoadedUserId === userData._id) { 
                loadSnippetById(lastSnippetId);
            }
        }
        
        const cursorStatus = document.getElementById('cursor-status');
        editor.onDidChangeCursorPosition(e => {
            if (cursorStatus) cursorStatus.textContent = `Ln ${e.position.lineNumber}, Col ${e.position.column}`;
        });

        editor.onDidChangeModelContent(() => {
            if (!editor) return;
            const payload = roomId ? { roomId, code: editor.getValue() } : editor.getValue();
            socket.emit('code-change', payload);
        });
    });

    // =============== socket handlers ===============
    socket.on('load-code', (code) => { if (editor) editor.setValue(code); });
    socket.on('code-update', (data) => {
    // First, check if the message came from a different user.
    if (data.senderId !== socket.id) {
        if (editor && editor.getValue() !== data.code) {
            // To make it smoother, we save the user's cursor position
            const currentPosition = editor.getPosition();
            
            editor.setValue(data.code);
            
            // And then we restore it after the update
            if (currentPosition) {
                editor.setPosition(currentPosition);
            }
        }
    }
});
    socket.on('connect', () => { const el = document.getElementById('connection-status'); if (el) el.textContent = 'Connected'; });
    socket.on('disconnect', () => { const el = document.getElementById('connection-status'); if (el) el.textContent = 'Disconnected'; });

    // NEW: Logout button event listener
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }

    // NEW: New File Button logic
    if (newFileBtn) {
        newFileBtn.addEventListener('click', () => {
            if (editor) {
                editor.setValue('// New file...\n');
            }
            if (document.getElementById("snippet-title")) {
                document.getElementById("snippet-title").textContent = "Untitled";
            }
            // Clear last loaded state
            localStorage.removeItem('lastLoadedSnippetId');
            localStorage.removeItem('lastLoadedUserId');
        });
    }
    
    // =============== room buttons ===============
    if (createRoomBtn) {
        createRoomBtn.addEventListener('click', () => {
            roomId = 'room-' + Math.random().toString(36).substring(2, 8);
            sessionStorage.setItem('roomId', roomId);
            socket.emit('join-room', roomId);
            updateRoomDisplay();
        });
    }
    if (joinRoomBtn) {
        joinRoomBtn.addEventListener('click', () => {
            const input = prompt("Enter Room ID:");
            if (input) {
                roomId = input;
                sessionStorage.setItem('roomId', roomId);
                socket.emit('join-room', roomId);
                updateRoomDisplay();
            }
        });
    }
    if (roomId) {
        socket.emit('join-room', roomId);
        updateRoomDisplay();
    }

    // =============== Run button ===============
    if (runBtn) {
        runBtn.addEventListener('click', async () => {
            outputConsole.textContent = "Running code...";
            outputConsole.className = 'output-log';
            try {
                const response = await fetch(`${API_BASE}/run`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ code: editor.getValue(), language: languageSelect.value })
                });
                const result = await response.json();
                outputConsole.textContent = result.output || "No output";
                if (result.output && result.output.toLowerCase().includes('error')) {
                    outputConsole.className = 'output-error';
                } else {
                    outputConsole.className = 'output-success';
                }
            } catch (error) {
                outputConsole.textContent = "Error: " + error.message;
                outputConsole.className = 'output-error';
            }
        });
    }

    // =============== Save flow ===============
    if (saveBtn) saveBtn.addEventListener('click', () => {
        populateFolderDropdown(); // NEW: Populate the dropdown before showing modal
        saveModal.classList.add('visible');
    });
    if (cancelSaveBtn) cancelSaveBtn.addEventListener('click', () => saveModal.classList.remove('visible'));

    if (confirmSaveBtn) {
        confirmSaveBtn.addEventListener('click', async () => {
            const nameInput = document.getElementById('snippet-name');
            const title = nameInput ? nameInput.value.trim() : '';
            if (!title) return alert('Please enter a title.');

            if (!token) {
                alert('You must be logged in to save. Please login first.');
                return;
            }

            const payload = {
                title,
                code: editor.getValue(),
                language: languageSelect.value,
                // NEW: Get the selected folder from the dropdown
                folder: saveFolderSelect.value
            };
            if (roomId) {
                payload.roomId = roomId;
            }

            try {
                const res = await fetch(`${API_BASE}/snippets`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify(payload)
                });

                if (!res.ok) {
                    const err = await res.json().catch(()=>({message: 'Save failed'}));
                    console.error('Save failed', err);
                    alert(err.message || 'Save failed');
                } else {
                    alert('Saved successfully!');
                    renderInEditorFileExplorer(); // NEW: Refresh the explorer after save
                }
            } catch (err) {
                console.error('Save failed:', err);
                alert('Save failed: ' + err.message);
            } finally {
                saveModal.classList.remove('visible');
                if (nameInput) nameInput.value = '';
            }
        });
    }

    // =============== Load flow (redirect to new dashboard) ===============
    if (loadBtn) {
        loadBtn.addEventListener('click', async () => {
            window.location.href = '/dashboard';
        });
    }
    if (cancelLoadBtn) cancelLoadBtn.addEventListener('click', () => loadModal.classList.remove('visible'));

    // =============== UI toggles ===============
    if (toggleLeftBtn) toggleLeftBtn.addEventListener('click', () => mainContentArea.classList.toggle('left-collapsed'));
    if (toggleOutputBtn) toggleOutputBtn.addEventListener('click', () => {
        outputWrapper.classList.toggle('collapsed');
        const bottomResizer = document.getElementById('resizer-bottom');
        if (bottomResizer) bottomResizer.style.display = outputWrapper.classList.contains('collapsed') ? 'none' : 'block';
    });

    // resizers (leave as-is)
    const leftResizer = document.getElementById('resizer-left');
    const bottomResizer = document.getElementById('resizer-bottom');
    const initResize = (resizer, onResize) => {
        if (!resizer) return;
        resizer.addEventListener('mousedown', (e) => {
            e.preventDefault();
            document.body.style.cursor = resizer.style.cursor;
            const onMouseMove = (moveEvent) => onResize(moveEvent);
            const onMouseUp = () => {
                window.removeEventListener('mousemove', onMouseMove);
                window.removeEventListener('mouseup', onMouseUp);
                document.body.style.cursor = 'default';
            };
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        });
    };
    initResize(bottomResizer, (e) => {
        const newHeight = window.innerHeight - e.clientY;
        const minHeight = 36;
        const maxHeight = window.innerHeight - 200;
        if (newHeight > minHeight && newHeight < maxHeight) {
            outputWrapper.style.height = `${newHeight}px`;
        }
    });

});
