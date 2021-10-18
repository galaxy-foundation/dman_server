require('dotenv').config();
import MySQLModel from './MySQLModel'
import {ethers} from 'ethers';
import axios from "axios"
import {parseString} from "xml2js"

const fs = require('fs');
const Logs = new MySQLModel('logs')

const chainid = Number(process.env.CHAIN_ID)
/* const blocktime = Number(process.env.BLOCKTIME) * 1000; */
const rpc = process.env.NETWORK_URL

const contracts = JSON.parse(fs.readFileSync(__dirname + '/../../frontend/src/config/contracts.json').toString());
const dmAddress:string = contracts[chainid].tokens.DM.address;
/* const dmDecimals:number = contracts[chainid].tokens.DM.decimals;
const usdtAddress:string = contracts[chainid].tokens.USDT.address;
const usdtDecimals:number = contracts[chainid].tokens.DM.decimals; */

const abiDM:any =    JSON.parse(fs.readFileSync(__dirname + '/../../frontend/src/config/abi/dmtoken.json').toString());
/* const abiErc20:any = JSON.parse(fs.readFileSync(__dirname + '/../../frontend/src/config/abi/erc20.json').toString()); */

const provider = new ethers.providers.JsonRpcProvider(rpc);
const dm = new ethers.Contract(dmAddress, abiDM, provider);

/* const p1 = 10 ** dmDecimals;
const p2 = 10 ** usdtDecimals; */

export const fromValue = (val, decimals) => Number(ethers.utils.formatUnits((val).toString(), decimals))

export interface PRICETYPE {
	[key:string]:number
}
export interface LOGTYPE {
	time:number
	tvl:number
}

const MAX = 24

export default class Contract {
	cb:(logs:any, prices:PRICETYPE)=>void;
	
	logs:Array<LOGTYPE> = [];
	prices:PRICETYPE = {};
	
	constructor(cb) {
		this.cb = cb;
		MySQLModel.connect({
			host: process.env.DB_HOST,
			port: Number(process.env.DB_PORT),
			user: process.env.DB_USER,
			password: process.env.DB_PASS,
			database: process.env.DB_NAME,
		}).then(async ()=>{
			const rows = await Logs.find({}, {id:-1},null, {limit:MAX})
			if (rows) {
				for(let k=rows.length-1; k>=0; k--) {
					const v = rows[k]
					this.logs.push({time:v.id, tvl:Number(v.tvl)})
				}
			}
			await this.readFiats()
			await this.readCryptos()
			await this.readContract();
			setInterval(this.readFiats.bind(this), 43200000)
			setInterval(this.readCryptos.bind(this), 15000)
			setInterval(this.readContract.bind(this), 15000)
			setInterval(this.run.bind(this), 15000)
		})
		
	}
	
	async readFiats() {
		try {
			let res :any = await axios.get("https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml")
			let result = await new Promise(resolve=>parseString(res.data, (err, result)=>resolve(result)))
			let rp = result['gesmes:Envelope']['Cube'][0]['Cube'][0]['Cube']
			let USD = Number(rp.find(v=>v.$.currency==='USD').$.rate)
			let CNY = Number(rp.find(v=>v.$.currency==='CNY').$.rate)
			this.prices.CNY = Number((CNY / USD).toFixed(2))
		}catch(err){
			console.log("request error",err.Error)
		}
		return 0;
	}
	async readCryptos() {
		try {
			let res:any = await axios.get("https://api.coingecko.com/api/v3/simple/price?ids=ethereum,tron,filecoin,ripple,polkadot,cardano,huobi-token&vs_currencies=usd");
			this.prices.DM = 1;
			this.prices.USDT = 1;
			this.prices.ETH = res.data.ethereum.usd;
			this.prices.TRX = res.data.tron.usd;
			this.prices.FIL = res.data.filecoin.usd;
			this.prices.XRP = res.data.ripple.usd;
			this.prices.DOT = res.data.polkadot.usd;
			this.prices.ADA = res.data.cardano.usd;
			this.prices.HT = res.data["huobi-token"].usd;
		}catch(err){
			console.log("request error",err.Error)
		}
	}
	async readContract() {
		try {
			const Daily = 328767;
			const poolList = [
				{token:'DM',   daily:Math.round(Daily*0.22)},  
				{token:'USDT', daily:Math.round(Daily*0.10)},  
				{token:'ETH',  daily:Math.round(Daily*0.10)},  
				{token:'TRX',  daily:Math.round(Daily*0.10)},  
				{token:'FIL',  daily:Math.round(Daily*0.10)},  
				{token:'XRP',  daily:Math.round(Daily*0.10)},  
				{token:'DOT',  daily:Math.round(Daily*0.10)},  
				{token:'ADA',  daily:Math.round(Daily*0.10)},  
				{token:'HT',   daily:Math.round(Daily*0.8),},  
			];
			const res = await dm.getStakerInfo('0x0000000000000000000000000000000000000000');
			let {pools} = res;
			/* 
			let i = 0;
			let presaleEndtime = Number(params[i++]);
			let limit1=fromValue(params[i++], dmDecimals);
			let limit2=fromValue(params[i++], dmDecimals);
			let remainder=fromValue(params[i++], dmDecimals);
			let reward=fromValue(params[i++], dmDecimals);
			let dmBalance=fromValue(params[i++], dmDecimals);
			let usdtBalance=fromValue(params[i++], 'USDT');
			let unlockable=fromValue(params[i++], dmDecimals);
			let rewardPool=fromValue(params[i++], dmDecimals);
			let rewardedTotal=fromValue(params[i++], dmDecimals);
			let insurancePool=fromValue(params[i++], dmDecimals);
			let insuranceBurnt=fromValue(params[i++], dmDecimals);
			
			let reserve0 = fromValue(params[i++], usdtDecimals); // Number(ethers.utils.formatUnits(pairUsdtBalance,6)),
			let reserve1 = fromValue(params[i++], dmDecimals); // Number(ethers.utils.formatUnits(pairDMBalance,18)) 
			*/


			
			let tvl = 0;
			let k=0;
			for(let i=0; i<poolList.length; i++) {
				const v = poolList[i];
				let _total = pools[k++];
				let _staking = pools[k++];
				let _reward = pools[k++];
				let _decimals = Number(pools[k++]);
				
				_decimals = Number(_decimals)
				_total = Number(ethers.utils.formatUnits(_total, _decimals))
				/* _staking = Number(ethers.utils.formatUnits(_staking, _decimals))
				_reward = Number(ethers.utils.formatUnits(_reward, 18)) */

				/* console.log("total",total, Number((v.daily * _staking / total).toFixed(2))); */
				/* _pools[v.token] = {
					reward: _reward,
					daily:  _total===0 ? 0 : Number((v.daily * _staking / _total).toFixed(2)),
					apr:	_total===0 ? 0 : (v.daily * 365) / _total / tokenPrices[v.token]*100,
					total:  _total
				} */
				tvl += _total * this.prices[v.token];
			}
			if (!isNaN(tvl)) {
				tvl = Math.round(tvl*100)/100;
				let now = Math.round(new Date().getTime() / 1000);
				let id = now - now % 3600;
				await Logs.insertOrUpdate({id, tvl})
				if (this.logs.length) {
					if (this.logs[this.logs.length-1].time===id) {
						this.logs[this.logs.length-1] = {time:id, tvl}
					} else {
						if (this.logs.length===MAX) this.logs.shift();
						this.logs.push({time:id, tvl})
					}
				} else {
					this.logs.push({time:id, tvl})
				}
			}
			
		} catch (err:any) {
			console.log(err)
		}
	}
	run() {
		this.cb(this.logs, this.prices);
	}
}