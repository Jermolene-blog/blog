import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, resample, dedup, quantize, meshopt, textureCompress, metalRough } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';

const [,, src, dst] = process.argv;
const KEEP = new Set(['Run','Sprint','CanonBall','Stand_Idle_01','StandHind_Idle_01','Attack_StandAngry_01_High',
  'Sitting_Idle_02','Trans_Stand_to_StandHind','Walk','Hit_Sitting_F01','Trot','Stand_Breathing_01']);
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(src);
for (const a of doc.getRoot().listAnimations()) if (!KEEP.has(a.getName())) { for (const s of a.listSamplers()) { s.getInput()?.dispose(); s.getOutput()?.dispose(); s.dispose(); } for (const c of a.listChannels()) c.dispose(); a.dispose(); }
await doc.transform(
  metalRough(), prune(), dedup(), resample({ tolerance: 1e-3 }),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [512, 512], quality: 80 }),
  quantize(), meshopt({ encoder: MeshoptEncoder, level: 'high' }), prune()
);
console.log(doc.getRoot().listAnimations().map(a => a.getName()));
await io.write(dst, doc);
