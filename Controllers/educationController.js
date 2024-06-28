const { pool } = require('../Config/dbConfig');

const addEducationWithInstitutionAndSkills = async (req, res) => {
    const client = await pool.connect();

    try {
        const userId = req.user.userId;
        const { name, branch, degree, school, startDate, endDate, grade, description } = req.body;

        // Check if all required fields are present
        if (!name || !branch || !degree || !school || !startDate || !endDate || !grade || !description ) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Start transaction
        await client.query('BEGIN');

        // Add institution and get institutionId
        const institutionId = await addInstitution(name, branch, client);

        // Insert education details
        const insertEducationQuery = `
            INSERT INTO educationdetails (user_id, institution_id, degree, school, start_date, end_date, grade, description)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING education_id`;

        const { rows } = await client.query(insertEducationQuery, [userId, institutionId, degree, school, startDate, endDate, grade, description]);
        const educationId = rows[0].education_id;

        // Commit transaction
        await client.query('COMMIT');

        // Respond with success message and educationId
        res.status(200).json({ message: 'Education details added successfully', educationId });

    } catch (error) {
        // Rollback transaction on error
        await client.query('ROLLBACK');
        console.error('Error adding education details:', error);
        res.status(500).json({ error: 'Failed to add education details' });

    } finally {
        client.release();
    }
};

const updateEducationById = async (req, res) => {
    const client = await pool.connect();
    try {
        const educationId = req.body.educationId;
        const userId = req.user.userId;
        const { name, branch, degree, school, startDate, endDate, grade, description, skills } = req.body;

        await client.query('BEGIN');

        if (name && branch) {
            const institutionId = await addInstitution(name, branch, client);
            await updateEducationDetails(client, educationId, userId, institutionId, degree, school, startDate, endDate, grade, description);
        } else {
            const getCurrentInstitutionQuery = `
                SELECT institution_id FROM EducationDetails WHERE education_id = $1`;
            const currentInstitutionResult = await client.query(getCurrentInstitutionQuery, [educationId]);

            if (currentInstitutionResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Education details not found' });
            }

            const institutionId = currentInstitutionResult.rows[0].institution_id;
            await updateEducationDetails(client, educationId, userId, institutionId, degree, school, startDate, endDate, grade, description);
        }

        await updateEducationSkills(client, educationId, skills);

        await client.query('COMMIT');

        res.status(200).json({ message: 'Education details updated successfully', educationId });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error updating education details:', err);
        res.status(500).json({ error: 'Error updating education details' });
    } finally {
        client.release();
    }
};

const updateEducationDetails = async (client, educationId, userId, institutionId, degree, school, startDate, endDate, grade, description) => {
    const updateEducationQuery = `
        UPDATE EducationDetails
        SET institution_id = $1,
            degree = COALESCE($2, degree),
            school = COALESCE($3, school),
            start_date = COALESCE($4, start_date),
            end_date = COALESCE($5, end_date),
            grade = COALESCE($6, grade),
            description = COALESCE($7, description)
        WHERE education_id = $8 AND user_id = $9`;
    await client.query(updateEducationQuery, [institutionId, degree, school, startDate, endDate, grade, description, educationId, userId]);
};

const getSkillsBasedOnEducationIdandallskillsbasesonExperienceId = async (req, res) => {

    const client = await pool.connect();
    const { educationId } = req.body.educationId;
    const { experienceId } = req.body.experienceId;

    try {
        const query = `SELECT 
        s.skill_id,
        s.skill_name
        FROM 
        EducationSkills es
        JOIN 
        Skills s ON es.skill_id = s.skill_id
        WHERE 
        es.education_id = $1
        UNION
        SELECT 
        s.skill_id,
        s.skill_name
        FROM 
        ExperienceSkills es
        JOIN 
        Skills s ON es.skill_id = s.skill_id
        WHERE 
        es.experience_id = $2`;
        const { rows } = await client.query(query, [educationId, experienceId]);
        const uniqueSkills = rows.filter((skill, index, self) =>
            index === self.findIndex((s) => (
                s.skill_id === skill.skill_id
            ))
        );
        res.status(200).json(uniqueSkills);
    }
    catch (err) {
        console.error('Error fetching skills based on education id:', err);
        res.status(500).json({ error: 'Error fetching skills based on education id' });
    } finally {
        client.release();
    }
};

const updateEducationSkills = async (client, educationId, skills) => {
    // Delete existing skills
    const deleteExistingSkillsQuery = `
        DELETE FROM EducationSkills
        WHERE education_id = $1`;
    await client.query(deleteExistingSkillsQuery, [educationId]);

    // Insert new skills
    await insertEducationSkills(client, educationId, skills);
};

const insertEducationSkills = async (client, educationId, skills) => {
    if (skills && skills.length > 0) {
        const skillInsertPromises = skills.map(async (skillName) => {
            // Check if skill already exists
            let skillId;
            const checkSkillQuery = `
                SELECT skill_id FROM Skills WHERE skill_name = $1`;
            const checkSkillResult = await client.query(checkSkillQuery, [skillName]);

            if (checkSkillResult.rows.length > 0) {
                skillId = checkSkillResult.rows[0].skill_id;
            } else {
                // Insert new skill if it doesn't exist
                const insertSkillQuery = `
                    INSERT INTO Skills (skill_name)
                    VALUES ($1)
                    RETURNING skill_id`;
                const skillResult = await client.query(insertSkillQuery, [skillName]);
                skillId = skillResult.rows[0].skill_id;
            }

            // Insert into EducationSkills junction table
            const insertEducationSkillQuery = `
                INSERT INTO EducationSkills (education_id, skill_id)
                VALUES ($1, $2)`;
            await client.query(insertEducationSkillQuery, [educationId, skillId]);
        });

        await Promise.all(skillInsertPromises);
    }
};

const deleteEducation = async (req, res) => {
    const client = await pool.connect();
    try {
        const { educationId } = req.body;
        const userId = req.user.userId;

        if (!educationId) {
            return res.status(400).json({ error: 'Education ID is required to delete education details' });
        }

        await client.query('BEGIN');

        const getEducationUserIdQuery = `
            SELECT user_id FROM EducationDetails WHERE education_id = $1`;
        const { rows } = await client.query(getEducationUserIdQuery, [educationId]);

        if (rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Education details not found' });
        }

        if (rows[0].user_id !== userId) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'Unauthorized to delete education details' });
        }

        const deleteEducationSkillsQuery = `
            DELETE FROM EducationSkills
            WHERE education_id = $1`;
        await client.query(deleteEducationSkillsQuery, [educationId]);

        const deleteEducationQuery = `
            DELETE FROM EducationDetails
            WHERE education_id = $1`;
        await client.query(deleteEducationQuery, [educationId]);

        await client.query('COMMIT');

        res.status(200).json({ message: 'Education details deleted successfully', educationId });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error deleting education details:', err);
        res.status(500).json({ error: 'Error deleting education details' });
    } finally {
        client.release();
    }
};

const addInstitution = async (name, branch, client) => {
    let institutionId;
    const checkInstitutionQuery = `
        SELECT institution_id FROM Institution WHERE name = $1 AND branch = $2`;
    const checkInstitutionResult = await client.query(checkInstitutionQuery, [name, branch]);

    if (checkInstitutionResult.rows.length > 0) {
        institutionId = checkInstitutionResult.rows[0].institution_id;
    } else {
        const insertInstitutionQuery = `
            INSERT INTO Institution (name, branch)
            VALUES ($1, $2)
            RETURNING institution_id`;
        const institutionResult = await client.query(insertInstitutionQuery, [name, branch]);
        institutionId = institutionResult.rows[0].institution_id;
    }

    return institutionId;
};

const getEducationDetailsByUserId = async (req, res) => {
    const client = await pool.connect();
    try {
        const userId = req.params.userId;

        const query = `
            SELECT 
                ed.education_id,
                ed.user_id,
                ed.degree,
                ed.school,
                ed.start_date,
                ed.end_date,
                ed.grade,
                ed.description,
                ins.name AS institution_name,
                ins.branch AS institution_branch,
                ARRAY_AGG(s.skill_name) AS skills
            FROM 
                EducationDetails ed
            JOIN 
                Institution ins ON ed.institution_id = ins.institution_id
            LEFT JOIN 
                EducationSkills es ON ed.education_id = es.education_id
            LEFT JOIN 
                Skills s ON es.skill_id = s.skill_id
            WHERE 
                ed.user_id = $1
            GROUP BY 
                ed.education_id, ins.name, ins.branch
            ORDER BY 
                ed.start_date DESC`;

        const { rows } = await client.query(query, [userId]);

        res.status(200).json(rows);
    } catch (error) {
        console.error('Error fetching education details:', error);
        res.status(500).json({ error: 'Error fetching education details' });
    } finally {
        client.release();
    }
};

module.exports = { addEducationWithInstitutionAndSkills, updateEducationById, deleteEducation, getEducationDetailsByUserId, getSkillsBasedOnEducationIdandallskillsbasesonExperienceId };
