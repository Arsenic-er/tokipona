import { MaterialGrid } from '../sim/material-grid';
import type { MaterialGridSave } from '../sim/material-grid-save';
import { Material } from '../sim/materials';
import type { Aabb } from '../runtime/geometry';

export interface ForestEmbersSave {
  readonly schema:'tokipona.forest-embers.v0.1';
  readonly activated:boolean;
  readonly releasedFuel:number;
  readonly grid:MaterialGridSave;
}
const WIDTH=24, HEIGHT=16, SEED=0x656d6265, FUEL=8;

/** A finite, stone-contained remnant fire. No spell, MP, infinite fuel or forest-wide ignition. */
export class ForestOpeningEmbers {
  readonly bounds=Object.freeze({x:2024,y:689,width:WIDTH,height:HEIGHT});
  private grid=new MaterialGrid(WIDTH,HEIGHT,SEED);
  private activated=false;
  private releasedFuel=0;
  private changes=0;
  constructor(saved?:ForestEmbersSave) {
    if(saved) { this.restore(saved); return; }
    for(let y=0;y<HEIGHT;y++) for(let x=0;x<WIDTH;x++) {
      this.grid.setMaterial(x,y,rock(x,y)?Material.Rock:
        x>=10 && x<14 && y>=11 && y<13?Material.Wood:Material.Air,
        x>=10 && x<14 && y>=11 && y<13?700:200);
    }
  }
  get revision():number {return this.changes;}
  advance(actor?:Aabb):void {
    // Like a sleeping local simulation chunk, the initial ember state wakes on approach.
    if(!this.activated && actor && Math.abs(actor.x-this.bounds.x)<128) this.activated=true;
    if(!this.activated) return;
    const before=this.grid.material.slice();
    const wasBurning=this.grid.burning.some(n=>n>0);
    this.grid.tick();
    if(before.some((m,i)=>m!==this.grid.material[i]) || wasBurning!==this.grid.burning.some(n=>n>0)) this.changes++;
    this.releasedFuel=FUEL-this.grid.material.filter(m=>m===Material.Wood || m===Material.Ash).length;
  }
  sample(x:number,y:number):{material:Material;burning:boolean}|null {
    const lx=Math.floor(x-this.bounds.x), ly=Math.floor(y-this.bounds.y);
    if(lx<0 || ly<0 || lx>=WIDTH || ly>=HEIGHT) return null;
    const cell=this.grid.sample(lx,ly);
    return {material:cell.material,burning:cell.burning>0};
  }
  save():ForestEmbersSave {
    return Object.freeze({schema:'tokipona.forest-embers.v0.1',activated:this.activated,
      releasedFuel:this.releasedFuel,grid:this.grid.save()});
  }
  private restore(saved:ForestEmbersSave):void {
    if(!saved || Object.keys(saved).sort().join()!==['schema','activated','releasedFuel','grid'].sort().join() ||
      saved.schema!=='tokipona.forest-embers.v0.1' || typeof saved.activated!=='boolean' ||
      !Number.isSafeInteger(saved.releasedFuel) || saved.releasedFuel<0 || saved.releasedFuel>FUEL ||
      saved.grid.width!==WIDTH || saved.grid.height!==HEIGHT || saved.grid.seed!==SEED) throw new Error('embers save invalid');
    const grid=MaterialGrid.fromSave(saved.grid);
    let fuel=0;
    for(let y=0;y<HEIGHT;y++) for(let x=0;x<WIDTH;x++) {
      const m=grid.getMaterial(x,y);
      if(rock(x,y)?m!==Material.Rock:![Material.Air,Material.Wood,Material.Ash].includes(m)) throw new Error('embers bank/material invalid');
      if(m===Material.Wood || m===Material.Ash) fuel++;
      if(m===Material.Wood && !(x>=10 && x<14 && y>=11 && y<13)) throw new Error('embers fuel moved');
    }
    if(fuel+saved.releasedFuel!==FUEL || !saved.activated && (saved.grid.tick!==0 || saved.releasedFuel!==0)) throw new Error('embers fuel ledger invalid');
    this.grid=grid; this.activated=saved.activated; this.releasedFuel=saved.releasedFuel;
  }
}
function rock(x:number,y:number):boolean {return y>=13 || (x===9 || x===14) && y>=9;}
