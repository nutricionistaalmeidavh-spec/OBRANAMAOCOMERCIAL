import { expect, it } from 'vitest';
import { parentStage, stageIsDelayed } from './p0-hierarchy';
const fronts=[
  {entity:'frentes_obra',localId:4,sourceDeviceId:'pc-a',payload:{nome:'Hidráulica'}},
  {entity:'frentes_obra',localId:4,sourceDeviceId:'pc-b',payload:{nome:'Elétrica'}}
];
it('vincula subetapa à etapa do mesmo dispositivo e ID',()=>{
 expect(parentStage({entity:'subfrentes_obra',localId:11,sourceDeviceId:'pc-b',payload:{frente_id:4}},fronts)).toBe('Elétrica');
 expect(parentStage({entity:'subfrentes_obra',localId:12,sourceDeviceId:'pc-c',payload:{frente_id:4}},fronts)).toBe('Etapa não sincronizada');
});
it('reconhece atraso no cronograma sem confundir etapa com etapa do planejamento',()=>{
 expect(stageIsDelayed({previsto_fim:'2026-10-30',percentual_realizado:60,status:'em andamento'},'2026-11-17')).toBe(true);
 expect(stageIsDelayed({previsto_fim:'2026-10-30',percentual_realizado:100,status:'concluida'},'2026-11-17')).toBe(false);
 expect(stageIsDelayed({previsto_fim:'2026-11-30',percentual_realizado:30,status:'em andamento'},'2026-11-17')).toBe(false);
});
