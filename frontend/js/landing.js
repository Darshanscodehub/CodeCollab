 document.addEventListener('DOMContentLoaded', () => {
            const internalLinks = document.querySelectorAll('a[href^="/"], a[href^="#"]');
            internalLinks.forEach(link => {
                link.addEventListener('click', function(e) {
                    const href = this.getAttribute('href');
                    // For on-page anchors, let the default smooth scroll behavior work
                    if (href.startsWith('#')) {
                        return;
                    }
                    // For other pages, add fade-out effect
                    e.preventDefault();
                    document.body.classList.add('fade-out');
                    setTimeout(() => {
                        window.location.href = href;
                    }, 500); // Match timeout with CSS animation duration
                });
            });
        });