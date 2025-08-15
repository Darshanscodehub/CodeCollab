 // Smooth transition for internal links
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

            const loginForm = document.getElementById('login-form');
            const formError = document.getElementById('form-error');

            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                formError.textContent = ''; // Clear previous errors

                const email = document.getElementById('email').value;
                const password = document.getElementById('password').value;

                if (!email || !password) {
                    formError.textContent = 'Please fill in all fields.';
                    return;
                }

                try {
                    const res = await fetch("/login", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ email, password })
                    });
                    
                    const data = await res.json();
                    
                    if (res.ok && data.token) {
                        localStorage.setItem("token", data.token);

                    // Save the user's name for avatar display
                    if (data.user && data.user.name) {
                        localStorage.setItem("user", JSON.stringify(data.user));  // 👈 FIXED
                    }

                        // Redirect with fade-out
                        document.body.classList.add('fade-out');
                        setTimeout(() => {
                            window.location.href = "/editor"; 
                        }, 500);
                    } else {
                        formError.textContent = data.message || "An unknown error occurred.";
                    }
                } catch (error) {
                    console.error("Login failed:", error);
                    formError.textContent = "Could not connect to the server.";
                }
            });
        });