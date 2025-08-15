// frontend/js/dashboard.js

const API_BASE = 'http://localhost:3000';
const token = localStorage.getItem('token') || null;

// New function to handle renaming a file
async function renameFile(fileId, oldTitle) {
    const newTitle = prompt(`Rename "${oldTitle}" to:`, oldTitle);
    if (newTitle && newTitle.trim() !== oldTitle) {
        try {
            const res = await fetch(`${API_BASE}/snippets/${fileId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ title: newTitle.trim() })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || 'Failed to rename file.');
            }

            alert(`File renamed to "${newTitle}".`);
            renderFileExplorer();
        } catch (error) {
            console.error('Error renaming file:', error);
            alert(error.message);
        }
    }
}

// Function to handle deleting a file
async function deleteFile(fileId, fileName) {
    if (confirm(`Are you sure you want to delete "${fileName}"? This cannot be undone.`)) {
        try {
            const res = await fetch(`${API_BASE}/snippets/${fileId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!res.ok) {
                throw new Error('Failed to delete snippet.');
            }
            
            alert(`Snippet "${fileName}" deleted.`);
            renderFileExplorer();
        } catch (error) {
            console.error('Error deleting snippet:', error);
            alert(error.message);
        }
    }
}


// Function to fetch and render the file explorer
async function renderFileExplorer() {
    const fileExplorerElement = document.getElementById('file-explorer');
    if (!fileExplorerElement || !token) {
        if (fileExplorerElement) {
            fileExplorerElement.innerHTML = '<div>Please log in to view your files.</div>';
        }
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/files`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch files: ${response.statusText}`);
        }

        const folders = await response.json();
        fileExplorerElement.innerHTML = '';

        if (folders.length === 0) {
            fileExplorerElement.innerHTML = '<div>You have no files or folders yet.</div>';
            return;
        }

        folders.forEach(folderData => {
            const folderContainer = document.createElement('div');
            
            const folderHeader = document.createElement('div');
            folderHeader.className = 'folder-item open'; // Start all folders as open for now
            
            const folderIcon = document.createElement('span');
            folderIcon.className = 'folder-icon';
            folderIcon.innerHTML = '&#9660;'; // Down-pointing arrow
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
                    window.location.href = `/editor?fileId=${file.id}`;
                });
    
                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = 'X'; 
                deleteBtn.className = 'delete-btn';
                deleteBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    await deleteFile(file.id, file.title);
                });

                fileActionsContainer.appendChild(deleteBtn);
                fileItem.appendChild(fileActionsContainer);
                fileList.appendChild(fileItem);

                // Add a right-click listener for file options
                fileItem.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    // Implement a simple menu here
                    const action = prompt(`File actions for "${file.title}":\n1. Rename\n2. Delete\n\nEnter option number:`);
                    if (action === '1') {
                        renameFile(file.id, file.title);
                    } else if (action === '2') {
                        deleteFile(file.id, file.title);
                    }
                });
            });
            
            folderContainer.appendChild(fileList);
            fileExplorerElement.appendChild(folderContainer);
            
            folderHeader.addEventListener('click', () => {
                folderHeader.classList.toggle('open');
            });
        });

    } catch (error) {
        console.error('Error fetching files:', error);
        fileExplorerElement.innerHTML = `<div>Error: ${error.message}</div>`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (!token) {
        window.location.href = '/login';
    } else {
        renderFileExplorer();
    }
    
    const createFolderBtn = document.getElementById('create-folder-btn');
    if (createFolderBtn) {
        createFolderBtn.addEventListener('click', async () => {
            const folderName = prompt("Enter a name for the new folder:");
            if (folderName) {
                try {
                    const res = await fetch(`${API_BASE}/folders`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ folderName })
                    });
    
                    if (!res.ok) {
                        const err = await res.json();
                        throw new Error(err.message || 'Failed to create folder.');
                    }
    
                    alert(`Folder "${folderName}" created successfully!`);
                    renderFileExplorer();
                } catch (error) {
                    console.error('Error creating folder:', error);
                    alert(error.message);
                }
            }
        });
    }
});