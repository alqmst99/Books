
/*############## Header ##############*/

//view responsive search form
const searchForm = document.querySelector('.search-form');
const searchBtn= document.querySelector('#search-btn');
searchBtn.addEventListener('click', ()=>{
    searchForm.classList.toggle('on');
});

//Fixed Header
window.onscroll= ()=>{
    searchForm.classList.remove('on');
    if(window.scrollY > 80){

        document.querySelector('.header-2').classList.add('active');
    }
    else{

        document.querySelector('.header-2').classList.remove('active');
    };

};
//Login Form

let loginForm= document.querySelector('.login-form-container')
let loginIco= document.querySelector('.login')
let loginClose= document.querySelector('#close-login')

loginIco.addEventListener('click', ()=>{
    loginForm.classList.add('view');
})
loginClose.addEventListener('click', ()=>{
    loginForm.classList.remove('view');
})
//Register

let regForm= document.querySelector('.reg-form-container')
let reg= document.querySelector('.reg')
let regClose= document.querySelector('#close-reg')

reg.addEventListener('click', ()=>{
    regForm.classList.add('view');
})
regClose.addEventListener('click', ()=>{
    regForm.classList.remove('view');
})


//Recharge 
window.onload= ()=>{
    if(window.scrollY > 80){

        document.querySelector('.header-2').classList.add('active');
    }
    else{

        document.querySelector('.header-2').classList.remove('active');
    };

    //fadeOut();
};

//Loader 
function loader(){
    let loader= document.querySelector('.loader-container');
    loader.classList.add('active');
    };
    // function fadeOut(){
    //     setTimeout(
    //         loader()
    //     , 1000);

    // };
