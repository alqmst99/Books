//Featured Slider
var swiper = new Swiper(".featured-slide", {
    loop:true,
    grabCursor:true,
    spaceBetween:10,
    centeredSlides:true,
    autoplay:{
       delay: 9500,
       disableOnInteraction:false,
    },
    navigation:{
nextEl:".swiper-button-next",
prevEl:".swiper-button-prev",
    },
       breakpoints: {
         0: {
           slidesPerView: 1,
       
         },
         450: {
            slidesPerView: 2,
          
          },
         768: {
           slidesPerView: 3,
         
         },
         1024: {
           slidesPerView: 4,
         
         },
      
       },
     });
     