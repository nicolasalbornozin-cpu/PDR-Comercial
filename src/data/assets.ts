import { ImageSourcePropType } from 'react-native';

export const images = {
  park: require('../../assets/images/park-hero.png'),
  seniorEvent: require('../../assets/images/senior-event.png'),
  gardenTable: require('../../assets/images/garden-table.png'),
} satisfies Record<string, ImageSourcePropType>;

export const newsImages: Record<string, ImageSourcePropType> = {
  park: images.park,
  seniorEvent: images.seniorEvent,
  gardenTable: images.gardenTable,
};
