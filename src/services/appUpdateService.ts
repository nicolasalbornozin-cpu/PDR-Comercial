import * as Updates from 'expo-updates';
import {createUpdateChecker} from '@/utils/updateCheck';

export const checkAppUpdate=createUpdateChecker({
 check:()=>Updates.checkForUpdateAsync(),
 download:()=>Updates.fetchUpdateAsync(),
});
