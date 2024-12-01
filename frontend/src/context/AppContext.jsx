import { createContext, useEffect, useState } from "react";
import { doctors } from "../assets/assets";
import axios from 'axios'
import {toast} from 'react-toastify'

export const AppContext = createContext();

const AppContextProvider = (props) => {

    const currencySymbol = "$"
    const backendUrl = import.meta.env.VITE_BACKEND_URL
    const [doctors,setDoctors] = useState([])
    const [token,setToken] = useState(localStorage.getItem('token') ? localStorage.getItem('token')  : false )//when we reload the page, it'll check the localstorage. if token is available it won't get logout, otherwise it'll logout. 
    const [userData,setUserData] = useState(false)

    const getDoctorsData = async() => {
        try{
          const {data} = await axios.get(backendUrl+'/api/doctor/list')
          if(data.success){
            setDoctors(data.doctors)
          }else{
            toast.error(data.message)
          }
        }catch(error){
            toast.error(error.message)
            console.log(error)
        }
    }

    const loadUserProfileData = async() => {
        try{
           const {data} = await axios.get(backendUrl+'/api/user/get-profile',{headers:{token}})
           if(data.success){
            setUserData(data.userData)
           }else{
             toast.error(data.message)
           }
        }catch(error){
            toast.error(error.message)
            console.log(error)
        }
    }

    useEffect(()=>{
        getDoctorsData()
     },[])

     useEffect(()=>{
       if(token){
        loadUserProfileData()
       }else{
        setUserData(false)
       }
     },[token])

    const value = {//whatever u store in value, u can access anywhere
        doctors,getDoctorsData,
        currencySymbol,
        token,setToken,
        backendUrl,
        userData,setUserData,
        loadUserProfileData
    }
   
    return (
        <AppContext.Provider value={value}>
            {props.children}
        </AppContext.Provider>
    )
}

export default AppContextProvider