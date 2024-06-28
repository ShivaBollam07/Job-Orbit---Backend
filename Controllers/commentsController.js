const { pool } = require('../Config/dbConfig');

const addComment = async (req, res) => {
    const { postId, description } = req.body;
    const userId = req.user.userId;

    if (!postId) {
        return res.status(400).json({ error: 'Post ID is required' });
    }
    if (!description) {
        return res.status(400).json({ error: 'Description is required' });
    }
    

    const client = await pool.connect();
    try {
        const query = `
            INSERT INTO Comments (post_id, user_id, description)
            VALUES ($1, $2, $3)
            RETURNING comment_id`;
        const { rows } = await client.query(query, [postId, userId, description]);

        const commentId = rows[0].comment_id;
        res.status(201).json({ message: 'Comment added successfully', commentId });
    } catch (err) {
        console.error('Error adding comment:', err);
        res.status(500).json({ error: 'Error adding comment' });
    } finally {
        client.release();
    }
};
const getCommentsByUserId = async (req, res) => {
    const userId = req.user.userId;

    const client = await pool.connect();
    try {
        const query = `
            SELECT * FROM Comments
            WHERE user_id = $1`;
        const { rows } = await client.query(query, [userId]);

        res.status(200).json(rows);
    } catch (err) {
        console.error('Error fetching comments by user:', err);
        res.status(500).json({ error: 'Error fetching comments by user' });
    } finally {
        client.release();
    }
};

const getCommentsByPostandalsocommenteduserdetails = async (req, res) => {
    const postId = req.body.post_id; // Use req.params to get postId from URL params

    const client = await pool.connect();
    try {
        const query = `
            SELECT c.comment_id, c.post_id, c.user_id, c.description, c.created_at, u.first_name, u.last_name
            FROM Comments c
            JOIN Users u ON c.user_id = u.user_id
            WHERE c.post_id = $1`;
        const { rows } = await client.query(query, [postId]);

        res.status(200).json(rows);
    } catch (err) {
        console.error('Error fetching comments by post:', err);
        res.status(500).json({ error: 'Error fetching comments by post' });
    } finally {
        client.release();
    }
};


module.exports = { addComment, getCommentsByPostandalsocommenteduserdetails, getCommentsByUserId};
