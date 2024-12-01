import jwt from 'jsonwebtoken'

//admin authentication middleware
const authAdmin = async(req,res,next) => {
   try{
     const {atoken} = req.headers
     if(!atoken){
        return res.json({success:false,message:'Not Authorized Login again'})
     }
     const token_decode = jwt.verify(atoken,process.env.JWT_SECRET)//decoding the token
     if(token_decode !== process.env.ADMIN_EMAIL + process.env.ADMIN_PASSWORD){//check decoded token doesn't match with admin email and password
        return res.json({success:false,message:'Not Authorized Login again'})
     }
     next()//if decode token matches, we call next() callback function
   }catch(error){
    console.log(error)
    res.json({success:false,message:error.message})
   }
}

export default authAdmin