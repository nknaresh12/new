(function() {
    const saved = localStorage.getItem('studenttrack-theme');
    if (saved === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    }

    document.addEventListener('DOMContentLoaded', function() {
        const btn = document.getElementById('darkToggleFloat');
        if (!btn) return;

        function updateIcon() {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            btn.textContent = isDark ? '☀️' : '🌙';
        }
        updateIcon();

        btn.addEventListener('click', function() {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            if (isDark) {
                document.documentElement.removeAttribute('data-theme');
                localStorage.setItem('studenttrack-theme', 'light');
            } else {
                document.documentElement.setAttribute('data-theme', 'dark');
                localStorage.setItem('studenttrack-theme', 'dark');
            }
            updateIcon();
        });
    });
})();
