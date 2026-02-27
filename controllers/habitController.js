const { readData, writeData } = require('../models/Habit');
const { readUserData, writeUserData } = require('../models/User');
const { calculateLevel } = require('../controllers/userController');
const crypto = require('crypto');

// @desc    Get all habits
// @route   GET /api/habits
exports.getAllHabits = async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        if (!userId) {
            return res.status(400).json({ message: 'User ID header is missing' });
        }

        let habits = await readData();
        habits = habits.filter(h => h.userId === userId);

        // Sort by createdAt descending
        habits.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        res.status(200).json(habits);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create new habit
// @route   POST /api/habits
exports.createHabit = async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        if (!userId) {
            return res.status(400).json({ message: 'User ID header is missing' });
        }

        const { habitName, category } = req.body;
        if (!habitName) {
            return res.status(400).json({ message: 'Habit name is required' });
        }

        const habits = await readData();
        const habitExists = habits.find(h => h.habitName === habitName && h.userId === userId);

        if (habitExists) {
            return res.status(400).json({ message: 'Habit already exists' });
        }

        const newHabit = {
            _id: crypto.randomUUID(),
            userId: userId,
            habitName: habitName,
            category: category || 'personal',
            createdAt: new Date().toISOString(),
            records: {},
            streakCount: 0
        };

        habits.push(newHabit);
        await writeData(habits);

        res.status(201).json(newHabit);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete habit
// @route   DELETE /api/habits/:id
exports.deleteHabit = async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        if (!userId) {
            return res.status(400).json({ message: 'User ID header is missing' });
        }

        const habits = await readData();
        const habitIndex = habits.findIndex(h => h._id === req.params.id && h.userId === userId);

        if (habitIndex === -1) {
            return res.status(404).json({ message: 'Habit not found or unauthorized' });
        }

        habits.splice(habitIndex, 1);
        await writeData(habits);

        res.status(200).json({ message: 'Habit removed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Helper function to get yesterday's date string YYYY-MM-DD
const getYesterdayString = (todayStr) => {
    const date = new Date(todayStr);
    date.setDate(date.getDate() - 1);
    return date.toISOString().split('T')[0];
};

// @desc    Mark habit completed for today
// @route   POST /api/habits/:id/mark
exports.markHabitCompleted = async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        if (!userId) {
            return res.status(400).json({ message: 'User ID header is missing' });
        }

        const habits = await readData();
        const habit = habits.find(h => h._id === req.params.id && h.userId === userId);

        if (!habit) {
            return res.status(404).json({ message: 'Habit not found or unauthorized' });
        }

        const todayStr = new Date().toISOString().split('T')[0];

        if (!habit.records) habit.records = {};

        // If already marked today, do nothing or return current habit
        if (habit.records[todayStr]) {
            return res.status(200).json(habit);
        }

        habit.records[todayStr] = true;

        // Streak logic
        const yesterdayStr = getYesterdayString(todayStr);
        let bonusXP = 0;

        if (habit.records[yesterdayStr]) {
            habit.streakCount += 1;
            // Bonus XP logic
            if (habit.streakCount === 7) bonusXP = 50;
            if (habit.streakCount === 14) bonusXP = 100;
            if (habit.streakCount === 30) bonusXP = 200;
        } else {
            habit.streakCount = 1;
        }

        await writeData(habits);

        // User XP logic
        const user = await readUserData();
        user.xp += 10 + bonusXP;
        user.level = calculateLevel(user.xp);
        await writeUserData(user);

        res.status(200).json(habit);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Unmark habit
// @route   POST /api/habits/:id/unmark
exports.unmarkHabit = async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        if (!userId) {
            return res.status(400).json({ message: 'User ID header is missing' });
        }

        const habits = await readData();
        const habit = habits.find(h => h._id === req.params.id && h.userId === userId);

        if (!habit) {
            return res.status(404).json({ message: 'Habit not found or unauthorized' });
        }

        const todayStr = new Date().toISOString().split('T')[0];

        if (!habit.records) habit.records = {};

        // If not marked today, do nothing
        if (!habit.records[todayStr]) {
            return res.status(200).json(habit);
        }

        delete habit.records[todayStr];

        // Streak logic revert:
        const yesterdayStr = getYesterdayString(todayStr);
        let lostBonusXP = 0;

        // Revert bonus logic if we had hit exactly the milestone yesterday
        if (habit.records[yesterdayStr]) {
            if (habit.streakCount === 7) lostBonusXP = 50;
            if (habit.streakCount === 14) lostBonusXP = 100;
            if (habit.streakCount === 30) lostBonusXP = 200;
            habit.streakCount = Math.max(0, habit.streakCount - 1);
        } else {
            habit.streakCount = 0;
        }

        await writeData(habits);

        // User XP revert logic
        const user = await readUserData();
        user.xp = Math.max(0, user.xp - 10 - lostBonusXP);
        user.level = calculateLevel(user.xp);
        await writeUserData(user);

        res.status(200).json(habit);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
