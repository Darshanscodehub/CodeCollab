 document.addEventListener('DOMContentLoaded', () => {
            const internalLinks = document.querySelectorAll('a[href^="/"]');
            internalLinks.forEach(link => {
                link.addEventListener('click', function(e) {
                    e.preventDefault();
                    document.body.classList.add('fade-out');
                    setTimeout(() => {
                        window.location.href = this.getAttribute('href');
                    }, 500);
                });
            });

            const signupForm = document.getElementById('signup-form');
            const formError = document.getElementById('form-error');

            signupForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                formError.textContent = '';

                const name = document.getElementById('name').value;
                const email = document.getElementById('email').value;
                const password = document.getElementById('password').value;

                if (!name || !email || !password) {
                    formError.textContent = 'Please fill in all fields.';
                    return;
                }

                try {
                    const res = await fetch("/signup", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ name, email, password })
                    });
                    const data = await res.json();
                    
                    if (res.ok) {
                        // On success, redirect to login with fade-out
                        document.body.classList.add('fade-out');
                        setTimeout(() => {
                            window.location.href = "/login"; 
                        }, 500);
                    } else {
                        formError.textContent = data.message || "An unknown error occurred.";
                    }
                } catch (error) {
                    console.error("Signup failed:", error);
                    formError.textContent = "Could not connect to the server.";
                }
            });
        });