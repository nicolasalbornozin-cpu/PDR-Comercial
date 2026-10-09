import { StyleSheet, Text, View } from 'react-native';
import { DetailHeader } from '@/components/DetailHeader';
import { ScreenContainer } from '@/components/ScreenContainer';
import { colors, radii, spacing, typography } from '@/theme';
import { CONDITIONS_VERSION, platformConditions } from '../supabase/functions/_shared/platformConditions';

export default function ConditionsScreen() {
  return <ScreenContainer contentContainerStyle={styles.page}>
    <DetailHeader title="Condiciones y datos personales"/>
    <Text style={styles.version}>Versión {CONDITIONS_VERSION} · pendiente de aprobación institucional</Text>
    {platformConditions.map(section=><View key={section.title} style={styles.card}><Text style={styles.title}>{section.title}</Text><Text style={styles.text}>{section.text}</Text></View>)}
  </ScreenContainer>;
}
const styles=StyleSheet.create({page:{padding:spacing.xl,gap:spacing.lg,maxWidth:700,width:'100%',alignSelf:'center'},version:{fontFamily:typography.sans,color:colors.goldText,fontSize:12},card:{backgroundColor:colors.surface,padding:spacing.lg,borderRadius:radii.lg,gap:spacing.sm},title:{fontFamily:typography.serif,fontSize:21,color:colors.primary},text:{fontFamily:typography.sans,fontSize:14,lineHeight:22,color:colors.text}});
