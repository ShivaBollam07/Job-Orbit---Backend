const { pool } = require('../Config/dbConfig');

const createPost = async (req, res) => {
    const { description } = req.body;
    const userId = req.user.userId;

    if (!description) {
        return res.status(400).json({ error: 'Description is required' });
    }

    const client = await pool.connect();
    try {
        const query = `
            INSERT INTO Posts (user_id, description)
            VALUES ($1, $2)
            RETURNING post_id`;
        const { rows } = await client.query(query, [userId, description]);

        const postId = rows[0].post_id;
        res.status(201).json({ message: 'Post created successfully', postId });
    } catch (err) {
        console.error('Error creating post:', err);
        res.status(500).json({ error: 'Error creating post' });
    } finally {
        client.release();
    }
};

const getPostsByUser = async (req, res) => {
    const userId = req.params.userId;
    const client = await pool.connect();
    try {
        const query = `
            SELECT * FROM Posts
            WHERE user_id = $1
            ORDER BY created_at ASC`;
        const { rows } = await client.query(query, [userId]);

        res.status(200).json(rows);
    } catch (err) {
        console.error('Error fetching posts by user:', err);
        res.status(500).json({ error: 'Error fetching posts by user' });
    } finally {
        client.release();
    }
};

const getPostsFeed = async (req, res) => {
    const client = await pool.connect();
    try {
        const query = `
            SELECT * FROM Posts
            ORDER BY created_at DESC`;
        const { rows } = await client.query(query);

        res.status(200).json(rows);
    } catch (err) {
        console.error('Error fetching posts:', err);
        res.status(500).json({ error: 'Error fetching posts' });
    } finally {
        client.release();
    }
};

const getUserDetailsbyPostId = async (req, res) => {
    const postId = req.body.postId;
    const client = await pool.connect();

    try {
        const query = `
            SELECT user_id FROM Posts
            WHERE post_id = $1`;
        const { rows } = await client.query(query, [postId]);
        const userId = rows[0].user_id;

        const userDetailsQuery = `
            SELECT * FROM Users
            WHERE user_id = $1`;
        const { rows: userDetails } = await client.query(userDetailsQuery, [userId]);

        res.status(200).json(userDetails[0]);
    } catch (err) {
        console.error('Error fetching user details:', err);
        res.status(500).json({ error: 'Error fetching user details' });
    } finally {
        client.release();
    }
};

const deletePost = async (req, res) => {
    const postId = req.params.postId;
    const userId = req.user.userId;

    const client = await pool.connect();
    try {

        const checkPostQuery = `
            SELECT * FROM Posts
            WHERE post_id = $1`;
        const { rows: post } = await client.query(checkPostQuery, [postId]);

        if (post.length === 0) {
            return res.status(404).json({ error: 'Post not found' });
        }

        if (post[0].user_id !== userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const deleteLikesQuery = `
            DELETE FROM Likes
            WHERE post_id = $1`;
        await client.query(deleteLikesQuery, [postId]);

        const deleteCommentsQuery = `
            DELETE FROM Comments
            WHERE post_id = $1`;
        await client.query(deleteCommentsQuery, [postId]);

        const deletePostQuery = `
            DELETE FROM Posts
            WHERE post_id = $1`;
        await client.query(deletePostQuery, [postId]);

        res.status(200).json({ message: 'Post deleted successfully' });


    } catch (err) {
        console.error('Error deleting post:', err);
        res.status(500).json({ error: 'Error deleting post' });
    } finally {
        client.release();
    }
};



module.exports = { createPost, getPostsByUser, getPostsFeed, deletePost, getUserDetailsbyPostId };
