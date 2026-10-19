import buldakImg from '../assets/BULDAK.png';
import friesImg from '../assets/FRIES.png';
import ramenKatsuImg from '../assets/RAMEN KATSU.png';
import sinugbaImg from '../assets/SINUGBA.png';
import sisigImg from '../assets/SISIG.png';
// import hoodieImg from '../assets/HOODIE.png'; // Uncomment when you have the hoodie image file

export const menuImages: Record<string, string> = {
  'pork-sinugba': sinugbaImg,
  'pork-sisig': sisigImg,
  'pork-katsu': sinugbaImg, // Placeholder
  'ramen-katsu': ramenKatsuImg,
  'buldak': buldakImg,
  'fries': friesImg,
  'hoodie': sinugbaImg, // Change to hoodieImg once your hoodie asset is added
};