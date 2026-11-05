import {initializeApp} from 'firebase/app';
import {getFirestore,doc,collection,getDoc,getDocs,setDoc,deleteDoc,onSnapshot} from 'firebase/firestore';

const app=initializeApp({
  apiKey:import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId:import.meta.env.VITE_FIREBASE_APP_ID
});
const fs=getFirestore(app);
const wrap=s=>({id:s.id,exists:typeof s.exists==='function'?s.exists():true,data:()=>s.data()});

// Misma interfaz que usa la app: db.doc(ruta) / db.collection(ruta)
export const db={
  doc:p=>({
    set:d=>setDoc(doc(fs,p),d),
    delete:()=>deleteDoc(doc(fs,p)),
    get:()=>getDoc(doc(fs,p)).then(wrap),
    onSnapshot:(next,err)=>onSnapshot(doc(fs,p),s=>next(wrap(s)),err)
  }),
  collection:p=>({
    get:()=>getDocs(collection(fs,p)).then(q=>({docs:q.docs.map(wrap)})),
    onSnapshot:(next,err)=>onSnapshot(collection(fs,p),q=>next({docs:q.docs.map(wrap)}),err)
  })
};

// Descarga normal del navegador
export const dl={
  save:async({filename,data,share})=>{
    if(share&&navigator.canShare){
      try{const f=new File([data],filename,{type:data.type||'image/png'});
        if(navigator.canShare({files:[f]})){await navigator.share({files:[f]});return}
      }catch(e){if(e&&e.name==='AbortError')return}
    }
    const a=document.createElement('a');
    a.href=URL.createObjectURL(data);a.download=filename;
    document.body.appendChild(a);a.click();a.remove();
  }
};
