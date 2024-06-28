const { pool } = require('../Config/dbConfig');

const likePost = async (req, res) => {
    const { postId } = req.params;
    const userId = req.user.userId
    const client = await pool.connect();
    try {
        const checkLikeQuery = `
            SELECT * FROM Likes
            WHERE post_id = $1 AND user_id = $2`;
        const { rows } = await client.query(checkLikeQuery, [postId, userId]);
        if (rows.length > 0) {
            return res.status(400).json({ error: 'You have already liked this post' });
        }
        const insertLikeQuery = `
            INSERT INTO Likes (post_id, user_id)
            VALUES ($1, $2)
            RETURNING like_id`;
        const result = await client.query(insertLikeQuery, [postId, userId]);

        const likeId = result.rows[0].like_id;
        res.status(201).json({ message: 'Post liked successfully', likeId });
    } catch (error) {
        console.error('Error liking post:', error);
        res.status(500).json({ error: 'Error liking post' });
    } finally {
        client.release();
    }
};

const isLiked = async (postId, userId) => {
    const client = await pool.connect();
    try {
        const checkLikeQuery = `
            SELECT * FROM Likes
            WHERE post_id = $1 AND user_id = $2`;
        const { rows } = await client.query(checkLikeQuery, [postId, userId]);

        return rows.length > 0;
    } catch (error) {
        console.error('Error checking if user liked post:', error);
        return false;
    } finally {
        client.release();
    }
};

const unlikePost = async (req, res) => {
    const { postId } = req.params;
    const userId = req.user.userId; 

    const client = await pool.connect();
    try {
        const deleteLikeQuery = `
            DELETE FROM Likes
            WHERE post_id = $1 AND user_id = $2`;
        await client.query(deleteLikeQuery, [postId, userId]);

        res.status(200).json({ message: 'Post unliked successfully' });
    } catch (error) {
        console.error('Error unliking post:', error);
        res.status(500).json({ error: 'Error unliking post' });
    } finally {
        client.release();
    }
};

const getLikesForPost = async (req, res) => {
    const { postId } = req.params;

    const client = await pool.connect();
    try {
        const getLikesQuery = `
            SELECT * FROM Likes
            WHERE post_id = $1`;
        const { rows } = await client.query(getLikesQuery, [postId]);

        res.status(200).json(rows);
    } catch (error) {
        console.error('Error fetching likes for post:', error);
        res.status(500).json({ error: 'Error fetching likes for post' });
    } finally {
        client.release();
    }
};

module.exports = { likePost, unlikePost, getLikesForPost, isLiked };
