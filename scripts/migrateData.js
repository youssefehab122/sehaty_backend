import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Source database (online)
const SOURCE_URI = 'mongodb+srv://youssefehab1222:4XXZn0r9gEIZiTfI@sehaty.uffzgjj.mongodb.net/test?retryWrites=true&w=majority';
const SOURCE_DB = 'test';

// Target database (local)
const TARGET_URI = 'mongodb://localhost:27017';
const TARGET_DB = 'sehaty';

// Collections to migrate
const COLLECTIONS = [
  'users',
  'medicines',
  'pharmacies',
  'prescriptions',
  'orders',
  'reminders',
  'addresses',
  'categories',
  'carts',
  'wishlists',
  'payments'
];

async function migrateData() {
  let sourceClient, targetClient;

  try {
    console.log('Starting data migration...');

    // Connect to source database
    console.log('Connecting to source database...');
    sourceClient = await MongoClient.connect(SOURCE_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
    });
    const sourceDb = sourceClient.db(SOURCE_DB);

    // Connect to target database
    console.log('Connecting to target database...');
    targetClient = await MongoClient.connect(TARGET_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    const targetDb = targetClient.db(TARGET_DB);

    // Migrate each collection
    for (const collectionName of COLLECTIONS) {
      console.log(`\nMigrating collection: ${collectionName}`);
      
      try {
        // Get collection from source
        const sourceCollection = sourceDb.collection(collectionName);
        
        // Get total count
        const totalDocs = await sourceCollection.countDocuments();
        console.log(`Total documents in ${collectionName}: ${totalDocs}`);

        // Get all documents
        const documents = await sourceCollection.find({}).toArray();
        console.log(`Retrieved ${documents.length} documents`);

        if (documents.length > 0) {
          // Clear existing data in target collection
          await targetDb.collection(collectionName).deleteMany({});
          console.log(`Cleared existing data in ${collectionName}`);

          // Insert documents in batches
          const batchSize = 100;
          for (let i = 0; i < documents.length; i += batchSize) {
            const batch = documents.slice(i, i + batchSize);
            await targetDb.collection(collectionName).insertMany(batch);
            console.log(`Inserted batch ${i / batchSize + 1} of ${Math.ceil(documents.length / batchSize)}`);
          }

          // Verify migration
          const targetCount = await targetDb.collection(collectionName).countDocuments();
          console.log(`Verification: ${targetCount} documents in target collection ${collectionName}`);
          
          if (targetCount !== documents.length) {
            console.warn(`Warning: Document count mismatch for ${collectionName}`);
            console.warn(`Source: ${documents.length}, Target: ${targetCount}`);
          }
        } else {
          console.log(`No documents to migrate in ${collectionName}`);
        }
      } catch (error) {
        console.error(`Error migrating collection ${collectionName}:`, error);
        // Continue with next collection
        continue;
      }
    }

    console.log('\nMigration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    if (error.name === 'MongoServerSelectionError') {
      console.error('Could not connect to MongoDB Atlas. Please check:');
      console.error('1. Your internet connection');
      console.error('2. The MongoDB Atlas connection string');
      console.error('3. IP whitelist in MongoDB Atlas');
    }
  } finally {
    // Close connections
    if (sourceClient) {
      await sourceClient.close();
      console.log('Source database connection closed');
    }
    if (targetClient) {
      await targetClient.close();
      console.log('Target database connection closed');
    }
  }
}

// Run migration
migrateData().catch(console.error); 