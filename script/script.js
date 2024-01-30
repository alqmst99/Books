/*############## Header & Main ##############*/

//View Responsive Search Form
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
    regForm.classList.toggle('view');
})
regClose.addEventListener('click', ()=>{
    regForm.classList.toggle('view');
})

//Detail

let detCard= document.querySelector('.det-container')
//let det= document.querySelector('.fa-search')
let detClose= document.querySelector('#close-det')

const det= ()=>{
    detCard.classList.toggle('view');
}
detClose.addEventListener('click', ()=>{
    detCard.classList.toggle('view');
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
        , 4000);

    };
