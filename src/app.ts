require("dotenv").config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
/* const isProduction = process.env.NODE_ENV === 'production'; */

import * as http from 'http';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import * as express from 'express';
import * as shrinkRay from 'shrink-ray-current'
import * as cors from 'cors'

import Contract from './contract'



process.on("uncaughtException", (err:Error) => setlog('exception',err));
process.on("unhandledRejection", (err:Error) => setlog('rejection',err));

export const setlog=(title:string='started',msg:string|Error|null=null):void=>{
    const date = new Date();
    let y:number = date.getUTCFullYear();
    let m:number = date.getUTCMonth() + 1;
    let d:number = date.getUTCDate();
    let hh:number = date.getUTCHours();
    let mm:number = date.getUTCMinutes();
    let ss:number = date.getUTCSeconds();
    let datetext:string = [y,('0' + m).slice(-2),('0' + d).slice(-2)].join('-');
    let timetext:string = [('0' + hh).slice(-2),('0' + mm).slice(-2),('0' + ss).slice(-2)].join(':');
    if (msg instanceof Error) msg = msg.stack || msg.message;
    let bStart = 0;
    if (title==='started') {
        bStart = 1;
        title = 'WebApp Started.';
    }
    if (msg) msg = msg.split(/\r\n|\r|\n/g).map(v=>'\t'+v).join('');
    let text = `[${timetext}] ${title}\r\n${msg===null?'':msg+'\r\n'}`;
    // fs.appendFileSync(__dirname+'/../logs/'+datetext+'.log',(bStart?'\r\n\r\n\r\n':'')+text);
    if (process.env.NODE_ENV !== 'production') console.log(text);
};

Date.now = () => Math.round((new Date().getTime()) / 1000);
/* 
interface CURRENCYPRICE {
	CNY:	number
	DM:		number
	USDT:	number
	ETH:	number
	TRX:	number
	FIL:	number
	XRP:	number
	DOT:	number
	ADA:	number
	HT:		number
}

const prices:CURRENCYPRICE = {
	CNY:	6.4,
	DM:		0,
	USDT:	0,
	ETH:	0,
	TRX:	0,
	FIL:	0,
	XRP:	0,
	DOT:	0,
	ADA:	0,
	HT:		0,
}; */


/* const getLogs = (req, res) => {

	res.json([]);
}

const cronLogs = () => {

} */

const run = async () => { 
	let logs:any[] = [];
	let prices:any = {}

	new Contract((_logs, _prices)=>{
		logs = _logs;
		prices = _prices
		console.log(new Date(), logs, prices)
	})

	const app = express()
	const server = http.createServer(app)
	const key = fs.readFileSync(__dirname+'/../certs/server.key', 'utf8')
	const cert = fs.readFileSync(__dirname+'/../certs/cdcf5746e8dc92d1.crt', 'utf8')
	const caBundle = fs.readFileSync(__dirname+'/../certs/gd_bundle-g2-g1.crt', 'utf8')
	const ca = caBundle.split('-----END CERTIFICATE-----\n') .map((cert:any) => cert +'-----END CERTIFICATE-----\n')
	ca.pop()

	let options = {cert,key,ca}
	const httpsServer = https.createServer(options,app)
	app.use(shrinkRay())
	app.use(cors({
		origin: function(origin, callback){
			const hosts = [
				'http://localhost',
				'https://localhost:8443',
				'http://localhost:3000',
				'http://185.25.51.72',
				'https://185.25.51.72',
			]
			if (origin===undefined || hosts.indexOf(origin)!==-1) return callback(null, true)
			console.log("blocked", origin)
			return
		}
	}))

	const FRONTENDPATH = path.normalize(__dirname + '/../../frontend/build')
	app.use(express.static(FRONTENDPATH))
	app.post("/api/logs",(req, res) => {
		res.json({logs, prices});
	})
	/* app.post("/api/logs",(req, res) => {
		res.json(prices);
	}) */
	app.get('*', (req,res) =>{
		console.log("request:", req.originalUrl)
		res.sendFile(FRONTENDPATH+'/index.html')
	})


	let time = +new Date()
	let port = Number(process.env.HTTP_PORT || 3030)
	await new Promise(resolve=>server.listen(port, ()=>resolve(true)))
	setlog(`Started HTTP service on port ${port}. ${+new Date()-time}ms`)
	time = +new Date()
	port = Number(process.env.HTTPS_PORT || 443)
	await new Promise(resolve=>httpsServer.listen(port, ()=>resolve(true)))
	setlog(`Started HTTPS service on port ${port}. ${+new Date()-time}ms`)
	/* cronLogs(); */
}

run()