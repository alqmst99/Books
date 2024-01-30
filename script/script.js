
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
//Recharge 
window.onload= ()=>{
    if(window.scrollY > 80){

        document.querySelector('.header-2').classList.add('active');
    }
    else{

        document.querySelector('.header-2').classList.remove('active');
    };

    fadeOut();
};

//Loader 
function loader(){
    let loader= document.querySelector('.loader-container');
    loader.classList.add('active');
    };
    function fadeOut(){
        setTimeout(
            loader()
        , 3000);
        console.log(Date.now());
    };
