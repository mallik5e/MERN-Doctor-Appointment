import validator from "validator";
import bcrypt from 'bcrypt';
import userModel from '../models/userModel.js'
import jwt from 'jsonwebtoken';
import {v2 as cloudinary} from 'cloudinary';
import doctorModel from '../models/doctorModel.js'
import appointmentModel from "../models/appointmentModel.js";
import Stripe from 'stripe';


//gateway initialize
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

//API to register user
const registerUser = async(req,res) => {
    try{
       const {name,email,password} = req.body;

       if(!name || !password || !email){
           return res.json({success:false,message:'Missing details'})
       }
       if(!validator.isEmail(email)){
        return res.json({success:false,message:'enter a valid email'})
       }
       if(password.length < 8){
        return res.json({success:false,message:'enter a strong password'})
       }

       //hashing your password
       const salt = await bcrypt.genSalt(10)
       const hashedPassword = await bcrypt.hash(password,salt)

       const userData = {
        name,
        email,
        password:hashedPassword
       }
 
      const newUser = new userModel(userData)
      const user = await newUser.save()

      const token = jwt.sign({id:user._id},process.env.JWT_SECRET)

      res.json({success:true,token})
       
    }catch(error){
        console.log(error)
        res.json({success:false,message:error.message})
    }
}

//API for user login
const loginUser = async(req,res) => {
    try{
      const {email,password} = req.body;
      const user = await userModel.findOne({email})

      if(!user){
        return res.json({success:false,message:'Invalid Credential'})
      }
      const isMatch = await bcrypt.compare(password,user.password)

      if(isMatch){
         const token = jwt.sign({id:user._id},process.env.JWT_SECRET)
         res.json({success:true,token})
      }else{
        res.json({success:false,message:'Invalid credential'})
      }

    }catch(error){
        console.log(error)
        res.json({success:false,message:error.message})
    }
}

//API to get user profile data
const getProfile = async(req,res) => {
    try{
      const {userId} = req.body;
      const userData = await userModel.findById(userId).select('-password')
      res.json({success:true,userData})

    }catch(error){
        console.log(error)
        res.json({success:false,message:error.message})
    }
}

//API to update user profile
const updateProfile = async(req,res) => {
  try{
    const {userId,name,phone,address,dob,gender} = req.body;
    const imageFile = req.file;

    if(!name || !phone || !dob || !gender ){
         return res.json({success:false,message:'Data Missing'})
    }
    await userModel.findByIdAndUpdate(userId,{name,phone,address:JSON.parse(address),dob,gender})

    if(imageFile){
      //upload image to cloudinary
      const imageUpload = await cloudinary.uploader.upload(imageFile.path,{resource_type:'image'})
      const imageUrl = imageUpload.secure_url//get url from cloudinary for image, to store in database
     // await userModel.findByIdAndUpdate(userId,{image:imageUrl})
      await userModel.findByIdAndUpdate(userId, { image: imageUrl });
       // Log the result of the database update
    }
    res.json({success:true,message:'Profile Updated'})
  }catch(error){
    console.log(error)
    res.json({success:false,message:error.message})
  }
}

const bookAppointment = async(req,res) => {
  try{
   const {userId,docId,slotDate,slotTime} = req.body;
   const docData = await doctorModel.findById(docId).select('-password')

   if(!docData.available){
    return res.json({success:false,message:'Doctor not available'})
   }
   let slots_booked = docData.slots_booked
   
   //checking the slot availablity
   if(slots_booked[slotDate]){//slot is booked in that date
      if(slots_booked[slotDate].includes(slotTime)){//slot is booked in that date of time
        return res.json({success:false,message:'Slot not available'})
      }else{
         slots_booked[slotDate].push(slotTime)
      }
   }else{
    slots_booked[slotDate] = []
    slots_booked[slotDate].push(slotTime)//if slot is available,then book the slot with time 
   }
   const userData =await userModel.findById(userId).select('-password')
   delete docData.slots_booked //remove slots booked data from the data

   const appointmentData = {
    userId,
    docId,
    userData,
    docData,
    amount:docData.fees,
    slotTime,
    slotDate,
    date:Date.now()
   }

   const newAppointment = new appointmentModel(appointmentData)
   await newAppointment.save()

   //save new slots data in docData
   await doctorModel.findByIdAndUpdate(docId,{slots_booked})

   res.json({success:true,message:'Appointment Booked'})

  }catch(error){
    console.log(error)
    res.json({success:false,message:error.message})
  }
}

//API to get user appointments for frontend my-appointment page
const listAppointment  = async(req,res) => {
    try{
        const {userId} =req.body;
        const appointments = await appointmentModel.find({userId})//find the appointment of that particular user

        res.json({success:true,appointments})
    }catch(error){
      console.log(error)
      res.json({success:false,message:error.message}) 
    }
}

//API to cancel appointment
const cancelAppointment = async(req,res) => {
  try{
    const {userId,appointmentId} = req.body;

    const appointmentData = await appointmentModel.findById(appointmentId)

   //verify appointment user
   if(appointmentData.userId !== userId){
    return res.json({success:false,message:'Unauthorized action'})
   }

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


//API to make payment of appointment using stripe
const paymentStripe = async(req,res) => {
  try{
    const {appointmentId} = req.body;
    const appointmentData = await appointmentModel.findById(appointmentId)
  //  const {origin} = req.headers;

    if(!appointmentData || appointmentData.cancelled){
         return res.json({success:false,message:'Appointment cancelled or not found'})
    }   


   const customer = await stripe.customers.create({
    name: 'Jenny Rosen',
    address: {
      line1: '510 Townsend St',
      postal_code: '98140',
      city: 'San Francisco',
      state: 'CA',
      country: 'US',
    },
  });

  const session = await stripe.checkout.sessions.create({
   // options,
    mode:'payment',
    payment_method_types:["card"],
    line_items: [
      {
        price_data: {
          currency: process.env.CURRENCY, // Use the currency from req.body
          product_data: {
            name: `Appointment ID: ${appointmentId}`, // Include the appointment ID in the product name
          },
          unit_amount: appointmentData.amount * 100, // Use the amount from req.body (make sure it's in the smallest currency unit)
        },
        quantity: 1,
      },
    ],
    customer: customer.id, // Link the customer to the checkout session
    success_url: `http://localhost:5173/my-appointments`,//payment success, redirect to success_url - ${origin}/verify?success=true&appointmentId=${appointmentId._id}
    cancel_url: `http://localhost:5173/cancel`,//payment fail, redirect to cancel_url - ${origin}/verify?success=false&appointmentId=${appointmentId._id}
  })
 // console.log(session)
 await appointmentModel.findByIdAndUpdate(appointmentId,{payment:true})
  res.json({success:true,session_url:session.url})
  }catch(error){
    console.log(error)
    res.json({success:false,message:error.message}) 
  }
}

//API to verify payment of stripe
const verifyStripe = async(req,res) => {
  const {appointmentId,success} = req.body;
  try{
     if(success === 'true'){
      await appointmentModel.findByIdAndUpdate(appointmentId,{payment:true})
      res.json({success:true,message:'Payment Successful'})
     }else{
      res.json({success:false,message:'Payment Failed'})
     }
  }catch(error){
    console.log(error)
    res.json({success:false,message:error.message})
  }
}


export {registerUser,loginUser,getProfile,updateProfile,bookAppointment,listAppointment,cancelAppointment,paymentStripe,verifyStripe}