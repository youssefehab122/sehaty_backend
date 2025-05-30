import Prescription from '../models/PrescriptionModel.js';
import Reminder from '../models/Reminder.js';
import Medicine from '../models/MedicineModel.js';
import Tesseract from 'tesseract.js';

// Upload prescription
export const uploadPrescription = async (req, res) => {
  try {
    const { title, prescriptionText, medicines, doctorName, doctorSpecialty, validUntil } = req.body;
    const image = req.file;

    if (!image) {
      return res.status(400).json({ message: 'No image file provided' });
    }

    console.log('Received file:', {
      filename: image.filename,
      path: image.path,
      mimetype: image.mimetype,
      size: image.size
    });

    // OCR: Extract text from image
    let ocrText = '';
    try {
      const ocrResult = await Tesseract.recognize(
        image.path,
        'eng+ara', // English and Arabic
        { logger: m => console.log(m) }
      );
      ocrText = ocrResult.data.text;
    } catch (ocrError) {
      console.error('OCR error:', ocrError);
      ocrText = '';
    }

    // Parse medicines if it's a string
    let parsedMedicines = [];
    if (medicines) {
      try {
        parsedMedicines = typeof medicines === 'string' ? JSON.parse(medicines) : medicines;
      } catch (error) {
        console.error('Error parsing medicines:', error);
        return res.status(400).json({ message: 'Invalid medicines format' });
      }
    }

    // Create the prescription with the correct image path
    const prescription = new Prescription({
      patientId: req.user._id,
      medicines: parsedMedicines,
      doctorName,
      doctorSpecialty,
      title,
      prescriptionText,
      validUntil,
      ocrText,
      image: {
        secure_url: `/uploads/prescriptions/${image.filename}`,
        public_id: image.filename
      }
    });

    await prescription.save();

    // Create reminders for each medicine if medicines are provided
    if (parsedMedicines && parsedMedicines.length > 0) {
      for (const medicine of parsedMedicines) {
        if (medicine.medicineId) {
          const reminder = new Reminder({
            prescriptionId: prescription._id,
            medicineId: medicine.medicineId,
            startDate: new Date(),
            endDate: validUntil,
            frequency: medicine.dosage?.frequency || 'once',
            status: 'active',
            dosage: medicine.dosage,
            notes: medicine.notes
          });
          await reminder.save();
        }
      }
    }

    res.status(201).json({
      message: 'Prescription uploaded successfully',
      prescription
    });
  } catch (error) {
    console.error('Error uploading prescription:', {
      error: error.message,
      stack: error.stack,
      file: error.file,
      code: error.code
    });
    
    res.status(500).json({ 
      message: error.message,
      error: {
        stack: error.stack,
        path: req.path,
        method: req.method,
        code: error.code
      }
    });
  }
};

// Get user prescriptions with specific fields
export const getUserPrescriptions = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status;

    const query = { 
      patientId: req.user._id,
      isDeleted: false 
    };
    if (status) query.status = status;

    const prescriptions = await Prescription.find(query)
      .populate({
        path: 'medicines.medicineId',
        select: 'name genericName image'
      })
      .select('doctorName doctorSpecialty image title createDate validUntil status')
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createDate: -1 });

    const total = await Prescription.countDocuments(query);

    res.json({
      prescriptions,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalPrescriptions: total
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get prescription details by ID
export const getPrescriptionById = async (req, res) => {
  try {
    const prescription = await Prescription.findById(req.params.id)
      .populate({
        path: 'medicines.medicineId',
        select: 'name genericName image description concentration'
      })
      .populate('patientId', 'name email phone');

    if (!prescription) {
      return res.status(404).json({ message: 'Prescription not found' });
    }

    // Check if user is authorized to view this prescription
    if (prescription.patientId._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to view this prescription' });
    }

    // Get associated reminders
    const reminders = await Reminder.find({
      prescriptionId: prescription._id,
      isDeleted: false
    }).populate('medicineId');

    res.json({ prescription, reminders });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update prescription status
export const updatePrescriptionStatus = async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;
    const prescription = await Prescription.findById(req.params.id);

    if (!prescription) {
      return res.status(404).json({ message: 'Prescription not found' });
    }

    // Check if user is authorized to update this prescription
    if (req.user.role !== 'admin' && req.user.role !== 'pharmacy_owner') {
      return res.status(403).json({ message: 'Not authorized to update this prescription' });
    }

    prescription.status = status;
    if (status === 'rejected') {
      prescription.rejectionReason = rejectionReason;
    }

    await prescription.save();

    // Update reminders based on status
    if (status === 'approved') {
      await Reminder.updateMany(
        { prescriptionId: prescription._id },
        { status: 'active' }
      );
    } else if (status === 'rejected') {
      await Reminder.updateMany(
        { prescriptionId: prescription._id },
        { status: 'missed' }
      );
    }

    res.json(prescription);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete prescription (soft delete)
export const deletePrescription = async (req, res) => {
  try {
    const prescription = await Prescription.findById(req.params.id);

    if (!prescription) {
      return res.status(404).json({ message: 'Prescription not found' });
    }

    // Check if user is authorized to delete this prescription
    if (prescription.patientId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to delete this prescription' });
    }

    // Soft delete prescription
    prescription.isDeleted = true;
    prescription.deletedAt = new Date();
    await prescription.save();

    // Soft delete associated reminders
    await Reminder.updateMany(
      { prescriptionId: prescription._id },
      { 
        isDeleted: true,
        deletedAt: new Date()
      }
    );

    res.json({ message: 'Prescription deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}; 