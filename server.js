const express = require('express');
const dotenv = require('dotenv');
const morgan = require('morgan');
const cors = require('cors'); // Import cors package
const userAuthRoute = require('./Routes/userAuthRoute');
const educationRoute = require('./Routes/educationRoute');
const experienceRoute = require('./Routes/experienceRoute');
const postsRoute = require('./Routes/postsRoute');
const commentsRoute = require('./Routes/commentsRoute');
const likesRoute = require('./Routes/likesRoute'); 
const JobsRoute = require('./Routes/JobsRoute'); 
dotenv.config({ path: './config.env' });

const app = express();

app.use(morgan('dev'));
app.use(express.json());
app.use(cors()); 
app.use('/app/v1/userauth', userAuthRoute);
app.use('/app/v1/education', educationRoute);
app.use('/app/v1/experience', experienceRoute);
app.use('/app/v1/posts', postsRoute);
app.use('/app/v1/comments', commentsRoute);
app.use('/app/v1/likes', likesRoute); 
app.use('/app/v1/jobs', JobsRoute); 

app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.backend_port || 3000;
app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
});
