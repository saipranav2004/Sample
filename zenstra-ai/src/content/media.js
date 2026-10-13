/* The product video. To publish it:
     1. put the file at public/media/zenstra-product-tour.mp4
     2. set src below to '/media/zenstra-product-tour.mp4' (and `length` to its running time)
     3. rebuild
   A "Watch the product tour" button then appears on the home console and on the
   platform page. While src is null the slot shows a tour of console screens. */
export const PRODUCT_VIDEO = {
  src: null,
  poster: '/img/screen-overview-dark.webp',
  title: 'Zenstra product tour',
  length: 'Product walkthrough',
};
