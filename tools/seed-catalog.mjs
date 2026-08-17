/**
 * Pass A — the catalog, as structured data.
 *
 * Metadata before imagery, always: `node tools/seed-catalog.mjs` writes
 * catalog.json, and only then does tools/seed-swatches.mjs generate one AI
 * swatch per entry from that entry's own texture_prompt.
 *
 * Weighted toward Indian occasion wear, with Andhra/Telangana handlooms
 * (Uppada, Venkatagiri, Mangalgiri, Pochampally, Kalamkari, Kosa) carried as
 * first-class entries — they are barely digitised anywhere else.
 *
 * Compact tuples expand into the full record so the catalog stays editable and
 * regenerable. Add a row, re-run, and the app picks it up.
 */
import { writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/* [id, name, subcategory, region, weaveDetail, usedFor, hex, hex2, gsm, drape, sheen, opacity, price, minM, seasons, occasions, tags] */
const FABRIC = [
// ---- heavy / occasion (drape 1-2, structure) ----
["kanchipuram","Kanchipuram silk","heavy","Tamil Nadu","dense mulberry silk weave with a contrast zari border","bridal sarees, lehenga skirts, structured bodices","#7c1f2e","#c9962e",120,2,4,5,2400,5.5,"winter,monsoon","wedding,reception","bridal,zari,temple"],
["banarasi","Banarasi brocade","heavy","Uttar Pradesh","raised gold floral butis on a satin ground","lehengas, sherwanis, jacket panels","#8c1f2f","#e0b83e",140,1,4,5,1900,5,"winter","wedding,reception","bridal,brocade,gold"],
["uppada","Uppada jamdani","heavy","Andhra Pradesh","fine handloom ground with inlaid jamdani motif work","sarees, dupattas, light lehengas","#0e6d74","#d4af5a",85,3,3,4,1650,5.5,"all","wedding,festive","handloom,jamdani,andhra"],
["paithani","Paithani","heavy","Maharashtra","tapestry weave with peacock motif and colour-shift sheen","sarees, dupatta borders","#1c6b4a","#b3202c",130,2,5,5,2800,5.5,"winter","wedding,reception","heritage,peacock,zari"],
["dupion","Dupion silk","heavy","Karnataka","visible slubs, crisp body, high sheen","bodices, structured skirts, jackets","#b3202c","#e8c07a",110,2,5,5,860,3,"all","reception,party","structured,sheen"],
["matka","Raw silk (matka)","heavy","West Bengal","coarse irregular slub, matte finish","jackets, bodices, kurtas","#c8873b","#8a7a5c",115,2,2,5,780,3,"winter,summer","festive,daily","matte,slub"],
["velvet","Velvet","heavy","Gujarat","deep pile that absorbs light, plush hand","winter lehengas, bodices, blouse yokes","#4a0f24","#2b0a16",320,1,3,5,880,4,"winter","wedding,reception","plush,winter,heavy"],
["zari-brocade","Zari brocade","heavy","Uttar Pradesh","metallic ground with a geometric repeat","borders, yokes, cuffs","#a16207","#e7c56a",160,1,5,5,1450,1.5,"winter","wedding","metallic,border"],
["tissue","Tissue silk","heavy","Tamil Nadu","sheer weave shot through with metallic","festive sarees, overlays","#e9ddc6","#d4af5a",60,3,5,2,1100,4,"all","festive,reception","sheer,metallic"],
["kosa","Kosa / tussar silk","heavy","Chhattisgarh","golden-tan natural sheen with a textured hand","sarees, kurtas, jackets","#b8863b","#8a6a3a",95,3,3,4,950,4.5,"all","festive,daily","natural,tussar"],
// ---- light / flowing (drape 4-5, movement) ----
["georgette","Georgette","light","Gujarat","grainy crinkle surface with a fluid fall","flowy lehengas, dupattas, sarees, anarkalis","#c05c77","#8f4055",60,5,2,4,420,5,"summer,monsoon","party,festive","flowy,everyday"],
["chiffon","Chiffon","light","Gujarat","near-transparent, weightless","dupattas, sarees, layered skirts","#d98aa6","#b8697f",45,5,3,2,380,4,"summer","party,festive","sheer,weightless"],
["organza","Organza","light","Karnataka","sheer with crisp body that holds its shape","sleeves, overlays, ruffles, dupattas","#c7a8c8","#a486a5",50,4,4,2,520,3,"summer,monsoon","reception,party","sheer,crisp"],
["net","Net / tulle","light","Gujarat","open mesh ground","cancan layers, dupattas, sleeves","#e8dccb","#cbbfa4",40,4,2,1,350,6,"all","wedding,party","mesh,volume"],
["mysore-crepe","Crepe (Mysore silk)","light","Karnataka","pebbled matte surface with a heavy fall","sarees, lining, slip dresses","#9e5b6c","#6f3f4c",85,4,2,5,640,5,"all","festive,daily","matte,fall"],
["satin","Satin","light","Surat","high-shine face, matte back","linings, slip gowns, piping","#274690","#16264f",95,4,5,5,540,3,"all","party,reception","shine,lining"],
["chanderi","Chanderi cotton-silk","light","Madhya Pradesh","sheer ground with a glossy micro-sheen","dupattas, kurtas, light sarees","#d9c9a3","#b8a26a",70,4,4,3,640,4,"summer,monsoon","festive,daily","sheer,handloom"],
["maheshwari","Maheshwari","light","Madhya Pradesh","reversible border with cotton-silk crispness","sarees, dupattas","#8c3f5d","#d4af5a",75,4,3,4,720,5.5,"all","festive,daily","handloom,reversible"],
["rayon","Rayon","light","Surat","soft viscose drape, matte","everyday kurtas, palazzos","#6b7f5c","#4c5c41",80,5,2,4,180,2.5,"summer,monsoon","daily","budget,everyday"],
["modal","Modal","light","Surat","silky-soft matte knit","inner layers, casual wear","#0e6d74","#0a4f54",100,4,2,5,610,2.5,"all","daily","soft,stretch",true],
// ---- cotton / handloom / everyday ----
["venkatagiri","Venkatagiri cotton","cotton","Andhra Pradesh","fine handloom with jamdani zari butis","sarees, kurtas","#efe6d4","#c9962e",70,4,2,4,780,5.5,"summer,monsoon","festive,daily","handloom,andhra,zari"],
["mangalgiri","Mangalgiri cotton","cotton","Andhra Pradesh","coarse handloom with a wide plain border","kurtas, blouses, sarees","#1c6b4a","#c9962e",120,3,1,5,420,3,"summer","daily,festive","handloom,andhra"],
["kalamkari","Kalamkari cotton","cotton","Andhra Pradesh","hand-painted mythological and floral block work","kurtas, blouses, jacket panels, dupattas","#a15c2e","#1d3f5c",130,3,1,5,560,3,"all","festive,daily","handpainted,andhra,heritage"],
["pochampally","Ikat (Pochampally)","cotton","Telangana","blurred-edge resist-dyed geometric pattern","kurtas, skirts, jackets","#2f3e9e","#e0b83e",125,3,1,5,650,3.5,"all","festive,daily","ikat,telangana,handloom"],
["khadi","Khadi","cotton","Gujarat","hand-spun irregular slub, matte","kurtas, jackets, structured skirts","#cfc2a4","#a89a7c",150,3,1,5,280,3,"summer,winter","daily","handspun,matte"],
["handloom-cotton","Handloom cotton","cotton","Tamil Nadu","plain weave with visible thread","everyday kurtas, blouses, linings","#e6d9bf","#c2b393",110,3,1,5,220,3,"summer","daily","budget,plain"],
["muslin","Muslin","cotton","West Bengal","ultra-fine sheer cotton","inner layers, toiles, lining","#f3ead8","#d9cdb4",50,5,1,2,190,3,"summer","daily","toile,lining"],
["linen","Linen","cotton","Kerala","dry crisp weave that creases naturally","summer kurtas, palazzos, shirts","#b8a88a","#8f8168",160,3,2,5,520,3,"summer","daily","breathable,crisp"],
["cambric","Cambric","cotton","Punjab","smooth tight plain weave","blouse lining, pockets","#efe6d4","#cfc2a4",100,3,1,5,140,2,"all","daily","lining,utility"],
["denim","Denim","cotton","Gujarat","diagonal twill with an indigo warp","casual jackets, skirts","#2f4a6b","#1d2f45",340,2,1,5,460,2,"winter","daily","casual,twill"],
];
/* [id, name, detail, usedFor, hex, price, tags] */
const THREAD = [
["zari-gold","Zari (gold)","flat metallic strip in warm gold","border weaving, zardosi, motif fill","#c9962e",160,"metallic,bridal"],
["zari-silver","Zari (silver)","flat metallic strip in cool white-silver","cooler embroidery, mirror outlines","#b9c0c9",150,"metallic,cool"],
["kasab","Kasab thread","thick metallic wound thread","heavy zardosi, yoke work","#d4af5a",190,"heavy,zardosi"],
["resham","Resham (silk floss)","lustrous smooth silk strands","thread work, satin stitch, floral fill","#b3202c",70,"floral,sheen"],
["resham-peacock","Resham — peacock","lustrous silk floss in peacock teal","motif fill, bird and vine work","#0e6d74",70,"floral,motif"],
["cotton-floss","Cotton embroidery floss","matte six-strand cotton","kantha, chikankari, running stitch","#8a7a5c",30,"matte,chikankari"],
["dabka","Dabka / bullion wire","spring-coil metallic wire","raised outlining, coiled texture work","#c9a24e",380,"raised,zardosi"],
["salma","Salma","thin coiled wire","fine metallic outlining","#cfd3d8",240,"fine,outline"],
["nakshi","Nakshi thread","twisted metallic cord","decorative knots, edging","#b98a2e",300,"knot,edging"],
["tinsel","Metallic tinsel thread","flat reflective filament","machine embroidery shimmer","#dfe6ee",90,"machine,shimmer"],
["jari-cord","Jari cord","round twisted gold cord","piping, corded outlines","#a16207",120,"piping,cord"],
];
/* [id, name, detail, usedFor, hex, price, tags] */
const EMBELLISH = [
["chamki","Round chamki bindis","flat mirror-finish discs","allover scatter on net, dupatta fields","#d4af5a",120,"scatter,shine"],
["teardrop-bindi","Teardrop bindis","elongated foil drops","border rows, neckline edging","#a11226",110,"border,foil"],
["sequin-cup","Sequins (cup)","concave reflective discs","dense allover shimmer, party wear","#e0b83e",180,"shimmer,dense"],
["kundan","Kundan stones","uncut glass set in gold foil","bridal yokes, neckline centrepieces","#e7c56a",420,"bridal,stone"],
["shisha","Shisha / mirror work","round convex mirrors","Kutch-style yokes, sleeve borders","#9fb6bd",240,"folk,mirror"],
["pearl","Freshwater pearls","soft off-white lustre","necklines, sleeve edging, latkans","#f4ecdd",360,"classic,edging"],
["bugle","Bugle beads","short glass tubes","fringe, linear fill","#1d1a17",200,"fringe,linear"],
["seed-bead","Seed beads","tiny uniform glass rounds","outlines, dense bead fill","#c96a4a",210,"outline,fill"],
["cutdana","Cutdana","faceted cut glass beads","sparkle fill between motifs","#dfe6ee",260,"sparkle,fill"],
["antique-bead","Antique gold beads","matte oxidised metal","heritage-style borders","#8a7a5c",300,"heritage,matte"],
["rhinestone","Rhinestones / chatons","faceted crystal, foil-backed","high-shine borders, statement work","#e8f0f7",600,"crystal,statement"],
["gota-motif","Gota patti motifs","flat gold ribbon shapes","Rajasthani appliqué on sleeves, hems","#e0b83e",280,"appliqué,rajasthani"],
["kasu","Kasu (coin) motifs","small stamped gold coins","temple-style borders, waistbands","#c9962e",520,"temple,coin"],
["stone-patti","Stone patti strips","linear stone-and-thread strip","pre-set stone lines for necklines","#d9c9a3",340,"linear,neckline"],
];
/* [id, name, detail, usedFor, hex, price, tags] */
const TRIM = [
["gota-border","Gota patti border","flat woven gold ribbon","hem and sleeve edging","#e0b83e",140,"festive,rajasthani"],
["zari-lace","Zari lace border","woven metallic edging with a motif repeat","saree and lehenga hems","#c9962e",260,"bridal,edging"],
["crochet-lace","Crochet lace","openwork cotton","blouse edging, sleeve frills","#efe6d4",180,"handmade,daily"],
["pompom","Pom-pom trim","small woollen balls on tape","dupatta edges, casual hems","#d0326e",95,"playful,casual"],
["latkan","Tassels / latkan","bunched thread with a bead cap","dupatta corners, blouse ties","#b3202c",130,"hem,corner"],
["piping","Piping cord","narrow covered cord","seam definition, neckline edges","#141210",70,"seam,edge"],
["fringe","Fringe trim","hanging thread curtain","hem movement, sleeve drama","#a15c2e",110,"movement,drama"],
["velvet-ribbon","Velvet ribbon","plush pile tape","waistbands, contrast edging","#4a0f24",160,"plush,waist"],
["satin-ribbon","Satin ribbon","smooth glossy tape","ties, bows, drawstrings","#274690",80,"tie,gloss"],
["potli-button","Potli buttons","hand-knotted fabric ball","front closures, cuff detail","#7c1f2e",120,"closure,classic"],
["hook-eye","Hook-and-eye set","small metal fastener","blouse closure","#8a8a8a",45,"closure,utility"],
["invisible-zip","Invisible zip","concealed slider","side seams, bodice back","#6f6659",60,"closure,utility"],
["cancan","Cancan net lining","stiff layered mesh","skirt volume","#efe6d4",190,"volume,lining"],
["canvas-interlining","Canvas interlining","rigid woven backing","structured bodices, collars","#cfc2a4",150,"structure,backing"],
];

const seasonsOf = s => s === "all" ? ["summer","monsoon","winter"] : s.split(",");
/* the generator ignores a hex, so name the colour — otherwise the swatch comes
   back whatever shade the model felt like and the UI colour is a lie */
function colourName(hex) {
  const [r,g,b] = [1,3,5].map(i => parseInt(hex.slice(i,i+2),16));
  const max=Math.max(r,g,b), min=Math.min(r,g,b), l=(max+min)/510, d=max-min;
  if (d < 26) return l > .8 ? "ivory" : l > .55 ? "light grey" : l > .3 ? "charcoal grey" : "near-black";
  let h = 0;
  if (max===r) h = 60*(((g-b)/d)%6); else if (max===g) h = 60*((b-r)/d+2); else h = 60*((r-g)/d+4);
  if (h<0) h+=360;
  const dark = l < .32, pale = l > .72;
  if (h<15||h>=345) return dark ? "deep wine red" : pale ? "blush pink" : "crimson red";
  if (h<40)  return dark ? "russet brown" : pale ? "peach" : "burnt orange";
  if (h<58)  return dark ? "antique bronze" : pale ? "pale gold" : "warm gold";
  if (h<90)  return dark ? "olive" : "mustard yellow";
  if (h<160) return dark ? "deep emerald green" : "green";
  if (h<200) return dark ? "deep teal" : "peacock teal";
  if (h<255) return dark ? "navy blue" : pale ? "powder blue" : "royal blue";
  if (h<290) return dark ? "aubergine" : "violet";
  return dark ? "deep magenta" : pale ? "rose pink" : "rani pink";
}
const FABRIC_TILE = (name, weave, region, hex) =>
  `Seamless tileable fabric swatch, ${name} from ${region} in ${colourName(hex)}, ${weave}, flat-lay top-down macro, studio soft even light, no folds, no shadows, no wrinkles, no garment, no hands, fills frame edge to edge, photographic texture detail`;
const ELEMENT_TILE = (name, detail, hex) =>
  `${name} in ${colourName(hex)}, ${detail}, many identical pieces scattered evenly edge to edge, macro product shot, pure white seamless background, top-down, sharp detail, no props, no hands, even light`;

const materials = [];

for (const [id,name,sub,region,weave,usedFor,hex,hex2,gsm,drape,sheen,opacity,price,minM,seasons,occasions,tags,stretch] of FABRIC) {
  materials.push({
    id, name, category:"fabric", subcategory:sub, region, usedFor,
    texture_prompt: FABRIC_TILE(name, weave, region, hex),
    hex, secondary_hex:hex2, gsm, drape, sheen, opacity,
    stretch: Boolean(stretch), pricePerMeter:price, minMeterage:minM,
    seasons: seasonsOf(seasons), occasions: occasions.split(","),
    pairsWith: [], avoidWith: [], tags: tags.split(","),
  });
}
const addElement = (rows, category, unit) => {
  for (const [id,name,detail,usedFor,hex,price,tags] of rows) {
    materials.push({
      id, name, category, subcategory:category, region:"India", usedFor,
      texture_prompt: ELEMENT_TILE(name, detail, hex),
      hex, secondary_hex:hex, gsm:0, drape:0, sheen: category==="thread"?4:3, opacity:5,
      stretch:false, pricePerMeter:price, minMeterage:unit,
      seasons:["summer","monsoon","winter"],
      occasions: /bridal|zardosi|kundan|temple|crystal|statement/.test(tags) ? ["wedding","reception"] : ["festive","daily"],
      pairsWith: [], avoidWith: [], tags: tags.split(","),
    });
  }
};
addElement(THREAD, "thread", 1);
addElement(EMBELLISH, "embellish", 1);
addElement(TRIM, "trim", 1.5);

/* ---- pairsWith / avoidWith: derived from real physics, then hand-corrected ----
   A structured ground carries weight; a fluid one cannot. This is exactly what
   the co-designer cites when it refuses a combination.                        */
const fabrics = materials.filter(m => m.category === "fabric");
const shared = (a, b) => a.filter(x => b.includes(x)).length;
for (const f of fabrics) {
  /* a good pair dresses the same event and falls the same way — ranked, so a
     bridal silk is never told to sit next to denim */
  f.pairsWith = fabrics
    .filter(o => o.id !== f.id && Math.abs(o.drape - f.drape) <= 1 && shared(o.occasions, f.occasions) > 0)
    .sort((a, b) => shared(b.occasions, f.occasions) - shared(a.occasions, f.occasions)
                 || Math.abs(a.gsm - f.gsm) - Math.abs(b.gsm - f.gsm))
    .slice(0, 5).map(o => o.id);
  /* avoidWith is STRUCTURAL: what fails when stitched into the same seam.
     A heavy skirt under a floating dupatta is correct — that is not a clash,
     so the app only consults this for zones that are actually joined.        */
  f.avoidWith = fabrics
    .filter(o => o.id !== f.id && (o.gsm - f.gsm > 170 || (Math.abs(o.drape - f.drape) >= 3 && Math.abs(o.gsm - f.gsm) > 60)))
    .slice(0, 5).map(o => o.id);
}
/* threads and embellishments belong on grounds that can hold a stitch */
for (const m of materials.filter(m => m.category !== "fabric")) {
  const heavyWork = /zardosi|bridal|raised|stone|crystal|coin|heavy/.test(m.tags.join(" "));
  m.pairsWith = fabrics.filter(f => heavyWork ? f.gsm >= 95 : f.gsm < 140).slice(0, 6).map(f => f.id);
  m.avoidWith = heavyWork ? fabrics.filter(f => f.gsm < 70 || f.opacity <= 2).slice(0, 5).map(f => f.id) : [];
}

const catalog = { generatedAt: new Date().toISOString(), count: materials.length, materials };
await writeFile(join(ROOT, "catalog.json"), JSON.stringify(catalog, null, 2));
console.log(`catalog.json — ${materials.length} materials ` +
  Object.entries(materials.reduce((a,m)=>(a[m.category]=(a[m.category]||0)+1,a),{})).map(([k,v])=>`${k}:${v}`).join(" "));
