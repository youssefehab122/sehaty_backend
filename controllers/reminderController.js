import Reminder from '../models/Reminder.js';
import User from '../models/UserModel.js';
import { addDays, startOfDay, endOfDay, parseISO } from 'date-fns';
import mongoose from 'mongoose';

// Create a new reminder
export const createReminder = async (req, res) => {
  try {
    const {
      product,
      title,
      description,
      medicineId,
      time,
      frequency,
      startDate,
      endDate,
      dosage,
      notes,
      notificationPreferences
    } = req.body;

    const reminders = [];
    let currentDate = startOfDay(new Date(startDate));
    const endDateTime = endOfDay(new Date(endDate));

    // Generate reminders for each day between startDate and endDate
    while (currentDate <= endDateTime) {
      // Create a new date object for the reminder time
      const reminderTime = new Date(currentDate);
      const timeDate = new Date(time);
      reminderTime.setHours(timeDate.getHours(), timeDate.getMinutes(), 0, 0);

      const reminder = new Reminder({
        user: req.user._id,
        medicineId,
        product,
        title,
        description,
        time: reminderTime,
        frequency,
        startDate: currentDate,
        endDate: endDateTime,
        dosage,
        notes,
        notificationPreferences,
        status: 'active',
        dailyStatuses: [{
          date: currentDate,
          status: 'active',
          isTaken: false
        }]
      });

      await reminder.save();
      reminders.push(reminder);

      // Move to next day
      currentDate = addDays(currentDate, 1);
    }

    // Add all reminders to user's reminders array
    await User.findByIdAndUpdate(req.user._id, {
      $push: { reminders: { $each: reminders.map(r => r._id) } }
    });

    res.status(201).json(reminders);
  } catch (error) {
    console.error('Error creating reminder:', error);
    res.status(500).json({ message: 'Error creating reminder', error: error.message });
  }
};

// Get all reminders for a user
export const getUserReminders = async (req, res) => {
  try {
    const reminders = await Reminder.find({
      user: req.user._id,
      isDeleted: false
    })
    .populate('medicineId', 'name image')
    .sort({ time: 1 });

    res.json(reminders);
  } catch (error) {
    console.error('Error fetching reminders:', error);
    res.status(500).json({ message: 'Error fetching reminders', error: error.message });
  }
};

// Get a single reminder
export const getReminder = async (req, res) => {
  try {
    const reminder = await Reminder.findOne({
      _id: req.params.id,
      user: req.user._id,
      isDeleted: false
    });

    if (!reminder) {
      return res.status(404).json({ message: 'Reminder not found' });
    }

    // Only populate medicineId if it's a valid ObjectId
    if (reminder.medicineId && mongoose.Types.ObjectId.isValid(reminder.medicineId)) {
      await reminder.populate('medicineId', 'name image');
    }

    res.json(reminder);
  } catch (error) {
    console.error('Error fetching reminder:', error);
    res.status(500).json({ message: 'Error fetching reminder', error: error.message });
  }
};

// Update a reminder
export const updateReminder = async (req, res) => {
  try {
    const {
      title,
      description,
      time,
      frequency,
      startDate,
      endDate,
      dosage,
      notes,
      product,
      notificationPreferences,
      status
    } = req.body;

    // Create update object without medicineId
    const updateData = {
      title,
      description,
      time,
      frequency,
      startDate,
      endDate,
      dosage,
      notes,
      product,
      notificationPreferences,
      status
    };

    // Remove any undefined or null values
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined || updateData[key] === null) {
        delete updateData[key];
      }
    });

    const reminder = await Reminder.findOneAndUpdate(
      {
        _id: req.params.id,
        user: req.user._id,
        isDeleted: false
      },
      updateData,
      { new: true }
    );

    if (!reminder) {
      return res.status(404).json({ message: 'Reminder not found' });
    }

    res.json(reminder);
  } catch (error) {
    console.error('Error updating reminder:', error);
    res.status(500).json({ message: 'Error updating reminder', error: error.message });
  }
};

// Delete a reminder (soft delete)
export const deleteReminder = async (req, res) => {
  try {
    const reminder = await Reminder.findOneAndUpdate(
      {
        _id: req.params.id,
        user: req.user._id,
        isDeleted: false
      },
      {
        isDeleted: true,
        deletedAt: new Date()
      },
      { new: true }
    );

    if (!reminder) {
      return res.status(404).json({ message: 'Reminder not found' });
    }

    // Remove reminder from user's reminders array
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { reminders: reminder._id }
    });

    res.json({ message: 'Reminder deleted successfully' });
  } catch (error) {
    console.error('Error deleting reminder:', error);
    res.status(500).json({ message: 'Error deleting reminder', error: error.message });
  }
};

// Get reminders for a specific date
export const getRemindersByDate = async (req, res) => {
  try {
    const { date } = req.params;
    // Parse the date string and convert to UTC
    const queryDate = new Date(date + 'T00:00:00.000Z');
    const endOfQueryDate = new Date(date + 'T23:59:59.999Z');

    console.log('Querying reminders for date:', {
      date,
      queryDate: queryDate.toISOString(),
      endOfQueryDate: endOfQueryDate.toISOString()
    });
    
    const reminders = await Reminder.find({
      user: req.user._id,
      isDeleted: false,
      $or: [
        {
          startDate: { $lte: endOfQueryDate },
          endDate: { $gte: queryDate }
        },
        {
          time: {
            $gte: queryDate,
            $lte: endOfQueryDate
          }
        }
      ]
    })
    .sort({ time: 1 });

    // Add the daily status for the requested date to each reminder
    const remindersWithStatus = reminders.map(reminder => {
      // Find existing status for this date
      const dailyStatus = reminder.dailyStatuses.find(
        status => {
          const statusDate = new Date(status.date);
          return statusDate.toISOString().split('T')[0] === date;
        }
      );

      // If no status exists for this date, create a default one
      if (!dailyStatus) {
        const newStatus = {
          date: queryDate,
          status: 'active',
          isTaken: false
        };
        reminder.dailyStatuses.push(newStatus);
        reminder.save(); // Save the new status to the database
      }

      // Convert to plain object and add the current status
      const reminderObj = reminder.toObject();
      reminderObj.currentStatus = dailyStatus || {
        date: queryDate,
        status: 'active',
        isTaken: false
      };

      return reminderObj;
    });

    console.log('Found reminders:', remindersWithStatus.length);
    
    res.json(remindersWithStatus);
  } catch (error) {
    console.error('Error fetching reminders by date:', error);
    res.status(500).json({ message: 'Error fetching reminders by date', error: error.message });
  }
};

// Mark reminder as taken
export const markReminderAsTaken = async (req, res) => {
  try {
    console.log('Request body:', req.body);
    console.log('Request params:', req.params);
    
    const { date, status } = req.body;
    if (!date || !status) {
      console.error('Missing required fields:', { date, status });
      return res.status(400).json({ 
        message: 'Date and status are required',
        received: { date, status }
      });
    }

    const reminder = await Reminder.findOne({
      _id: req.params.id,
      user: req.user._id,
      isDeleted: false
    });

    if (!reminder) {
      return res.status(404).json({ message: 'Reminder not found' });
    }

    // Parse the date string and convert to UTC
    const targetDate = new Date(date + 'T00:00:00.000Z');
    console.log('Target date:', {
      inputDate: date,
      targetDate: targetDate.toISOString()
    });

    // Find or create daily status
    let dailyStatus = reminder.dailyStatuses.find(
      status => {
        const statusDate = new Date(status.date);
        return statusDate.toISOString().split('T')[0] === date;
      }
    );

    if (!dailyStatus) {
      // If no status exists for this date, create one
      dailyStatus = {
        date: targetDate,
        status: 'active',
        isTaken: false
      };
      reminder.dailyStatuses.push(dailyStatus);
    }

    // Update the status and isTaken based on the new status
    dailyStatus.status = status;
    dailyStatus.isTaken = status === 'completed';

    // Update the main status only if this is today's reminder
    const now = new Date();
    const today = new Date(now.toISOString().split('T')[0] + 'T00:00:00.000Z');
    if (targetDate.toISOString().split('T')[0] === today.toISOString().split('T')[0]) {
      reminder.status = status;
      reminder.isTaken = status === 'completed';
    }

    await reminder.save();

    // Return the reminder with the current status for the requested date
    const reminderObj = reminder.toObject();
    reminderObj.currentStatus = dailyStatus;

    res.json(reminderObj);
  } catch (error) {
    console.error('Error marking reminder as taken:', error);
    res.status(500).json({ 
      message: 'Error marking reminder as taken', 
      error: error.message,
      stack: error.stack
    });
  }
};