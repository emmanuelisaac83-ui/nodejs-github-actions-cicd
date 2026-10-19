
const express = require('express');
const app = express();

// Set the default template engine.
app.set('view engine', 'ejs');

// Serve static files from the public directory.
app.use(express.static('public'));

// Render the home page.
app.get('/', (req, res) => {
    res.render('index');
});

// Export the app so automated tests can use it.
module.exports = app;

// Start the server only when this file is run directly.
if (require.main === module) {
    const PORT = process.env.PORT || 3000;

    app.listen(PORT, () => {
        console.log(`App running on port ${PORT}`);
    });
}
