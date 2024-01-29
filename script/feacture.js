var swiper = new Swiper(".featured-slide", {
    loop:true,
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
     var swiper = new Swiper(".arrivals-slide", {
      loop:true,
      centeredSlides:true,
      autoplay:{
         delay: 9500,
         disableOnInteraction:false,
      },
         breakpoints: {
           0: {
             slidesPerView: 1,
         
           },

           768: {
             slidesPerView: 2,
           
           },
           1024: {
             slidesPerView: 3,
           
           },
        
         },
       });