import mongoose from 'mongoose'
import dotenv from 'dotenv'

// Load environment variables from .env file
dotenv.config();


const connectDB = async () => {
mongoose.connection.on('connected',()=>{
    console.log('DB Connected')
})
await mongoose.connect(`${process.env.MONGODB_URI}/prescripto`)
}

export default connectDB;
