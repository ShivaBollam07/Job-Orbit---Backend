const { pool } = require('../Config/dbConfig');
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

dotenv.config({ path: './config.env' });

const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
        user: process.env.google_user_mail,
        pass: process.env.google_user_app_password,
    },
});

const JobsController = {
    getAllJobs: async (req, res) => {
        const client = await pool.connect();
        try {
            const query = `SELECT * FROM jobs`;
            const { rows } = await client.query(query);
            res.status(200).json(rows);
        } catch (err) {
            console.error('Error fetching jobs:', err);
            res.status(500).json({ error: 'Error fetching jobs' });
        } finally {
            client.release();
        }
    },

    applyJob: async (req, res) => {
        try {
            const { link, token } = req.body;

            if (!link) {
                return res.status(400).json({ error: 'Link is required' });
            }

            const mailOptions = {
                from: process.env.google_user_mail,
                to: 'bollamshivatilak@gmail.com',
                subject: 'Application for Job',
                text: `Please find my resume link for the job application: ${link}`
            };

            await transporter.sendMail(mailOptions);

            res.status(200).json({ message: 'Resume sent successfully' });
        } catch (err) {
            console.error('Error sending resume:', err);
            res.status(500).json({ error: 'Error sending resume' });
        }
    }
};

module.exports = JobsController;
