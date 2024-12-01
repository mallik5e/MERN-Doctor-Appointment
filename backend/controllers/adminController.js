import validator from 'validator'
import bcyrpt from 'bcryptjs'
import {v2 as cloudinary} from 'cloudinary'
import doctorModel from '../models/doctorModel.js'
import jwt from 'jsonwebtoken'
import appointmentModel from '../models/appointmentModel.js'
import userModel from '../models/userModel.js'

//API for adding doctor
const addDoctor = async(req,res) => {
    
    try{
     const {name,email,password,speciality,degree,experience,about,fees,address} = req.body;
     const imageFile = req.file;

    if(!name || !email || !password || !degree || !speciality || !experience || !about || !fees || !address){
        return res.json({success:false,message:'Missing in Details'})
    }
    //validate email
    if(!validator.isEmail(email)){
        return res.json({success:false,message:'Enter a valid email'})
    }
   
    //validate password
    if(password.length < 8){
        res.json({success:false,message:'Enter strong password'})
    }

    //encode password to store in database
    const salt = await bcyrpt.genSalt(10)
    const hashedPassword = await bcyrpt.hash(password,salt)

    //upload image to cloudinary
    const imageUpload = await cloudinary.uploader.upload(imageFile.path,{resource_type:'image'})
    const imageUrl = imageUpload.secure_url//get url from cloudinary for image, to store in database
    console.log(imageUrl)
    const doctorData={
        name,
        email,
        password,
        image:imageUrl,
        password:hashedPassword,
        speciality,
        degree,
        experience,
        about,
        fees,
        address:JSON.parse(address),
        date:Date.now()
    }
    const newDoctor = new doctorModel(doctorData)
    await newDoctor.save()
    res.json({success:true,message:'Doctor added'})
     
    }catch(error){
        console.log(error)
        res.json({success:false,message:error.message})
    }
}

const loginAdmin = async(req,res) => {
    try{
      const {email,password} = req.body;
      if(email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD){
         const token = jwt.sign(email+password,process.env.JWT_SECRET)
         res.json({success:true,token})
      }else{
        res.json({success:false,message:'Invalid Credentials'})
      }
    }catch(error){
        console.log(error)
        res.json({success:false,message:error.message})
    }
}

//Api to get all doctors list for admin panel
const allDoctors = async(req,res) => {
    try{
    const doctors = await doctorModel.find({}).select('-password')//exclude password property
    res.json({success:true,doctors})
    }catch(error){
        console.log(error)
        res.json({success:false,message:error.message})
    }
}

//API to get all appointment list
const appointmentsAdmin = async(req,res) => {
    try{
      const appointments = await appointmentModel.find({})
      res.json({success:true,appointments})
    }catch(error){
        console.log(error)
        res.json({success:false,message:error.message})
    }
}

//API for appointment cancelation
const appointmentCancel = async(req,res) => {
   try{
    const {appointmentId} = req.body;

    const appointmentData = await appointmentModel.findById(appointmentId)

    await appointmentModel.findByIdAndUpdate(appointmentId,{cancelled:true})

   //releasing doctor slot
   const {docId,slotDate,slotTime} = appointmentData

   const doctorData = await doctorModel.findById(docId)
   let slots_booked = doctorData.slots_booked

   slots_booked[slotDate] = slots_booked[slotDate].filter(e => e !== slotTime)

   await doctorModel.findByIdAndUpdate(docId,{slots_booked})

   res.json({success:true,message:'Appointment Cancelled'})
   }catch(error){
    console.log(error)
    res.json({success:false,message:error.message})
   }
}

//API to get dashboard data for admin panel
const adminDashboard = async (req,res) => {
     try{
       const doctors = await doctorModel.find({})
       const users = await userModel.find({})
       const appointments = await appointmentModel.find({})

//Get to know total no. of doctors, total no. of appointments, total no. of patients, and latestAppointments.
       const dashData = {
        doctors: doctors.length,
        appointments:appointments.length,
        patients:users.length,
        latestAppointments:appointments.reverse().slice(0,5)
       }
      res.json({success:true,dashData})
     }catch(error){
        console.log(error)
        res.json({success:false,message:error.message})
     }
}

export {addDoctor,loginAdmin,allDoctors,appointmentsAdmin,appointmentCancel,adminDashboard}
