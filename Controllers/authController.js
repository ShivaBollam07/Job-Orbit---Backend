const dotenv = require('dotenv');
const { pool } = require('../Config/dbConfig');
dotenv.config({ path: './config.env' });
const jwt = require('jsonwebtoken');

const bcrypt = require('bcryptjs');

const signup = async (req, res) => {
    const { email, website, firstName, middleName, lastName, about, password } = req.body;
    if (!email || !password || !firstName || !lastName) {
        return res.status(400).json({ error: 'Please provide all required fields' });
    }
    const gmailRegex = /^[a-zA-Z0-9._%+-]+@(gmail\.com|googlemail\.com)$/;
    if (!gmailRegex.test(email)) {
        return res.status(400).json({ error: 'Please provide a valid Gmail address' });
    }
    if (password.length < 8 || password.search(/[a-z]/) < 0 || password.search(/[A-Z]/) < 0 || password.search(/[0-9]/) < 0) {
        return res.status(400).json({ error: 'Password must be at least 8 characters long and contain at least one lowercase letter, one uppercase letter, and one digit' });
    }


    const client = await pool.connect();
    try {
        const checkEmailQuery = 'SELECT * FROM contactinformation WHERE email = $1';
        const checkEmailResult = await client.query(checkEmailQuery, [email]);

        if (checkEmailResult.rows.length > 0) {
            return res.status(400).json({ error: 'Account already exists with this email' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        await client.query('BEGIN');

        const insertContactQuery = 'INSERT INTO contactinformation (email, website) VALUES ($1, $2) RETURNING contact_id';
        const contactResult = await client.query(insertContactQuery, [email, website]);
        const contactId = contactResult.rows[0].contact_id;

        const insertUserQuery = `
            INSERT INTO users (first_name, middle_name, last_name, contact_id, about, hashedpassword)
            VALUES ($1, $2, $3, $4, $5, $6) RETURNING user_id`;
        const userResult = await client.query(insertUserQuery, [firstName, middleName, lastName, contactId, about, hashedPassword]);
        const userId = userResult.rows[0].user_id;

        await client.query('COMMIT');
        res.status(201).json({ message: 'User created successfully', userId });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error in signup:', err);
        res.status(500).json({ error: 'Error creating user' });
    } finally {
        client.release();
    }
};

const login = async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Please provide email and password' });
    }
    const client = await pool.connect();
    try {
        const query = `
            SELECT u.user_id, u.first_name, u.middle_name, u.last_name, u.about, c.email, c.website, u.hashedpassword
            FROM users u
            JOIN contactinformation c ON u.contact_id = c.contact_id
            WHERE c.email = $1`;
        const result = await client.query(query, [email]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = result.rows[0];
        const passwordMatch = await bcrypt.compare(password, user.hashedpassword);

        if (!passwordMatch) {
            return res.status(401).json({ error: 'Invalid password' });
        }

        const token = jwt.sign(
            {
                userId: user.user_id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
            },
            process.env.JWT_SECRET_KEY,
            { expiresIn: process.env.JWT_EXPRIES_TIME }
        );

        res.status(200).json({
            message: 'Login successful',
            token,
            user: {
                userId: user.user_id,
                firstName: user.first_name,
                middleName: user.middle_name,
                lastName: user.last_name,
                email: user.email,
                website: user.website,
                about: user.about
            }
        });
    } catch (err) {
        console.error('Error in login:', err);
        res.status(500).json({ error: 'Error logging in' });
    } finally {
        client.release();
    }
};

const updateProfile = async (req, res) => {
    const userId = req.user.userId;
    const { firstName, middleName, lastName, about } = req.body;

    if (!firstName && !middleName && !lastName && !about) {
        return res.status(400).json({ error: 'Please provide at least one field to update' });
    }

    const client = await pool.connect();
    try {
        const checkUserQuery = 'SELECT * FROM users WHERE user_id = $1';
        const checkUserResult = await client.query(checkUserQuery, [userId]);
        if (checkUserResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const updateQuery = `
            UPDATE users
            SET first_name = COALESCE($1, first_name),
                middle_name = COALESCE($2, middle_name),
                last_name = COALESCE($3, last_name),
                about = COALESCE($4, about)
            WHERE user_id = $5
            RETURNING user_id`;
        const updateResult = await client.query(updateQuery, [firstName, middleName, lastName, about, userId]);

        res.status(200).json({ message: 'Profile updated successfully', userId: updateResult.rows[0].user_id });
    } catch (err) {
        console.error('Error updating profile:', err);
        res.status(500).json({ error: 'Error updating profile' });
    } finally {
        client.release();
    }
};

const changePassword = async (req, res) => {
    const userId = req.user.userId;
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
        return res.status(400).json({ error: 'Please provide old and new passwords' });
    }

    if (oldPassword === newPassword) {
        return res.status(400).json({ error: 'Old and new passwords cannot be the same' });
    }

    const client = await pool.connect();
    try {
        const getUserQuery = 'SELECT * FROM users WHERE user_id = $1';
        const getUserResult = await client.query(getUserQuery, [userId]);

        if (getUserResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = getUserResult.rows[0];
        const passwordMatch = await bcrypt.compare(oldPassword, user.hashedpassword);

        if (!passwordMatch) {
            return res.status(401).json({ error: 'Invalid old password' });
        }

        const hashedNewPassword = await bcrypt.hash(newPassword, 10);

        const updatePasswordQuery = 'UPDATE users SET hashedpassword = $1 WHERE user_id = $2';
        await client.query(updatePasswordQuery, [hashedNewPassword, userId]);

        res.status(200).json({ message: 'Password updated successfully' });
    } catch (err) {
        console.error('Error changing password:', err);
        res.status(500).json({ error: 'Error changing password' });
    } finally {
        client.release();
    }
};

const deleteAccount = async (req, res) => {
    const userId = req.user.userId;

    const client = await pool.connect();
    try {
        const checkUserQuery = 'SELECT * FROM users WHERE user_id = $1';
        const checkUserResult = await client.query(checkUserQuery, [userId]);

        if (checkUserResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        await client.query('BEGIN');

        // Delete likes associated with the user
        const deleteLikesQuery = 'DELETE FROM Likes WHERE user_id = $1';
        await client.query(deleteLikesQuery, [userId]);

        // Delete comments made by the user
        const deleteUserCommentsQuery = 'DELETE FROM Comments WHERE user_id = $1';
        await client.query(deleteUserCommentsQuery, [userId]);

        // Fetch posts by the user
        const fetchPostsQuery = 'SELECT post_id FROM Posts WHERE user_id = $1';
        const postsResult = await client.query(fetchPostsQuery, [userId]);
        const postIds = postsResult.rows.map(row => row.post_id);

        // Delete comments related to the posts
        for (const postId of postIds) {
            const deletePostCommentsQuery = 'DELETE FROM Comments WHERE post_id = $1';
            await client.query(deletePostCommentsQuery, [postId]);
        }

        // Delete posts after comments
        const deletePostsQuery = 'DELETE FROM Posts WHERE user_id = $1';
        await client.query(deletePostsQuery, [userId]);

        // Delete experience details associated with the user
        const deleteExperienceDetailsQuery = 'DELETE FROM ExperienceDetails WHERE user_id = $1';
        await client.query(deleteExperienceDetailsQuery, [userId]);

        // Delete education details associated with the user
        const deleteEducationDetailsQuery = 'DELETE FROM EducationDetails WHERE user_id = $1';
        await client.query(deleteEducationDetailsQuery, [userId]);

        // Delete user institutions associated with the user
        const deleteUserInstitutionsQuery = 'DELETE FROM user_institutions WHERE user_id = $1';
        await client.query(deleteUserInstitutionsQuery, [userId]);

        // Delete contact information associated with the user
        const deleteContactInfoQuery = 'DELETE FROM contactinformation WHERE contact_id = (SELECT contact_id FROM users WHERE user_id = $1)';
        await client.query(deleteContactInfoQuery, [userId]);

        // Finally, delete the user record
        const deleteUserQuery = 'DELETE FROM users WHERE user_id = $1';
        await client.query(deleteUserQuery, [userId]);

        await client.query('COMMIT');

        res.status(200).json({ message: 'Account deleted successfully' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error deleting account:', err);
        res.status(500).json({ error: 'Error deleting account' });
    } finally {
        // Release the client back to the pool
        client.release();
    }
};

const getuserdetailsbasedonuserid = async (req, res) => {
    const user_id = req.body.user_id;
    const client = await pool.connect();
    try {
        const query = `
            SELECT u.user_id, u.first_name, u.middle_name, u.last_name, u.about, c.email, c.website
            FROM users u
            JOIN contactinformation c ON u.contact_id = c.contact_id
            WHERE u.user_id = $1`;
        const { rows } = await client.query(query, [user_id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.status(200).json(rows[0]);
    } catch (err) {
        console.error('Error fetching user details:', err);
        res.status(500).json({ error: 'Error fetching user details' });
    } finally {
        client.release();
    }
};

const useralldetails = async (req, res) => {
    const userId = req.user.userId;

    const client = await pool.connect();
    try {

        const checkUserQuery = 'SELECT * FROM users WHERE user_id = $1';
        const checkUserResult = await client.query(checkUserQuery, [userId]);
        if (checkUserResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const userDetailsQuery = `
            SELECT u.user_id, u.first_name, u.middle_name, u.last_name, u.about, c.email, c.website
            FROM users u
            JOIN contactinformation c ON u.contact_id = c.contact_id
            WHERE u.user_id = $1`;
        const userDetailsResult = await client.query(userDetailsQuery, [userId]);
        const user = userDetailsResult.rows[0];

        const educationQuery = `
            SELECT ed.education_id, ins.name AS institution_name, ins.branch AS institution_branch, ed.degree, ed.school, ed.start_date, ed.end_date, ed.grade, ed.description
            FROM EducationDetails ed
            JOIN Institution ins ON ed.institution_id = ins.institution_id
            WHERE ed.user_id = $1`;
        const educationResult = await client.query(educationQuery, [userId]);
        const educationDetails = educationResult.rows;

        const getAllSkillsQueryoftheuser =
            `SELECT s.skill_id, s.skill_name
        FROM Skills s
        JOIN EducationSkills es ON s.skill_id = es.skill_id
        JOIN EducationDetails ed ON es.education_id = ed.education_id
        WHERE ed.user_id = $1`;
        const getAllSkillsResult = await client.query(getAllSkillsQueryoftheuser, [userId]);
        const skills = getAllSkillsResult.rows;

        const experienceQuery = `
            SELECT exp.experience_id, comp.name AS company_name, comp.branch AS company_branch, exp.job_role, exp.start_date, exp.end_date, exp.job_type, exp.description
            FROM ExperienceDetails exp
            JOIN Company comp ON exp.company_id = comp.company_id
            WHERE exp.user_id = $1`;
        const experienceResult = await client.query(experienceQuery, [userId]);
        const experienceDetails = experienceResult.rows;

        const postsQuery = `
            SELECT p.post_id, p.description, p.created_at
            FROM Posts p
            WHERE p.user_id = $1`;
        const postsResult = await client.query(postsQuery, [userId]);
        const posts = postsResult.rows;

        res.status(200).json({
            user,
            educationDetails,
            skills,
            experienceDetails,
            posts
        });
    } catch (err) {
        console.error('Error fetching user details:', err);
        res.status(500).json({ error: 'Error fetching user details' });
    } finally {
        client.release();
    }
};

const alldetailsofauserbyuserid = async (req, res) => {
    const userId = req.body.user_id;

    const client = await pool.connect();
    try {

        const checkUserQuery = 'SELECT * FROM users WHERE user_id = $1';
        const checkUserResult = await client.query(checkUserQuery, [userId]);
        if (checkUserResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const userDetailsQuery = `
            SELECT u.user_id, u.first_name, u.middle_name, u.last_name, u.about, c.email, c.website
            FROM users u
            JOIN contactinformation c ON u.contact_id = c.contact_id
            WHERE u.user_id = $1`;
        const userDetailsResult = await client.query(userDetailsQuery, [userId]);
        const user = userDetailsResult.rows[0];

        const educationQuery = `
            SELECT ed.education_id, ins.name AS institution_name, ins.branch AS institution_branch, ed.degree, ed.school, ed.start_date, ed.end_date, ed.grade, ed.description
            FROM EducationDetails ed
            JOIN Institution ins ON ed.institution_id = ins.institution_id
            WHERE ed.user_id = $1`;
        const educationResult = await client.query(educationQuery, [userId]);
        const educationDetails = educationResult.rows;

        const skillsQuery = `
            SELECT s.skill_id, s.skill_name
            FROM Skills s
            JOIN EducationSkills es ON s.skill_id = es.skill_id
            JOIN EducationDetails ed ON es.education_id = ed.education_id
            WHERE ed.user_id = $1`;
        const skillsResult = await client.query(skillsQuery, [userId]);
        const skills = skillsResult.rows;

        const experienceQuery = `
            SELECT exp.experience_id, comp.name AS company_name, comp.branch AS company_branch, exp.job_role, exp.start_date, exp.end_date, exp.job_type, exp.description
            FROM ExperienceDetails exp
            JOIN Company comp ON exp.company_id = comp.company_id
            WHERE exp.user_id = $1`;
        const experienceResult = await client.query(experienceQuery, [userId]);
        const experienceDetails = experienceResult.rows;

        const postsQuery = `
            SELECT p.post_id, p.description, p.created_at
            FROM Posts p
            WHERE p.user_id = $1`;
        const postsResult = await client.query(postsQuery, [userId]);
        const posts = postsResult.rows;

        res.status(200).json({
            user,
            educationDetails,
            skills,
            experienceDetails,
            posts
        });
    } catch (err) {
        console.error('Error fetching user details:', err);
        res.status(500).json({ error: 'Error fetching user details' });
    } finally {
        client.release();
    }

}

module.exports = { alldetailsofauserbyuserid, signup, login, updateProfile, changePassword, deleteAccount, useralldetails, getuserdetailsbasedonuserid };