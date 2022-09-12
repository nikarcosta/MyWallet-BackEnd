import express, {json} from "express";
import cors from "cors";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";
import joi from "joi";
import bcrypt from "bcrypt";
import {v4 as uuid} from "uuid";
import dayjs from "dayjs";


const app = express();
app.use(cors());
app.use(json());
dotenv.config();

let db = null;
const mongoClient = new MongoClient(process.env.MONGO_URL);
const promise = mongoClient.connect();
promise.then(() => {
    db = mongoClient.db(process.env.BANCO);
    console.log("Conexão com o banco de dados MongoDB estabelecida!");
});
promise.catch((e) => console.log("Erro ao se conectar com o banco de dados", e));

app.post("/sign-up", async (req, res) => {

    const { nome, email, senha, confirmacaoDeSenha } = req.body;

    const  cadastroSchema = joi.object({
        nome: joi.string().required(),
        email: joi.string().email().required(),
        senha: joi.string().required(),
        confirmacaoDeSenha: joi.ref("senha")
    });

    const { error } = cadastroSchema.validate(req.body, { abortEarly: false});

    if(error){
        res.status(422).send(error.details.map(detail => detail.message));
        return;
    }

    try {
        const usuario = await db.collection("usuarios").insertOne({
            nome,
            email,    
            senha: bcrypt.hashSync(senha, 10)});
        console.log("usuario criado", usuario);
        res.sendStatus(201);
    } catch(e) {
        console.log("Erro ao registrar", e);
        return res.sendStatus(500);
    }

});

app.post("/sign-in", async (req, res) => {
    const { email, senha } = req.body;

    const loginSchema = joi.object({
        email: joi.string().email().required(),
        senha: joi.string().required()
    });

    const { error } = loginSchema.validate(req.body, { abortEarly: false});

    if(error){
        res.status(422).send(error.details.map(detail => detail.message));
        return;
    }

    try {
        const usuario = await db.collection("usuarios").findOne({email});
        if(!usuario){
            return res.sendStatus(404);
        }
    
        if(usuario && bcrypt.compareSync(senha, usuario.senha)){
            const token = uuid();
            
            await db.collection("sessoes").insertOne({ token, usuarioId: usuario._id});
    
            res.status(200).send(token);
        } else {
            res.send("Usuário ou senha incorretos.Tente novamente").status(404);
        }
    } catch(e) {
        res.sendStatus(500);
        console.log("Erro ao fazer o login!", e);
    }
    
});


app.get("/transactions", async (req, res) => {
    const { authorization } = req.headers;
    const token = authorization?.replace("Bearer", "").trim();

    if(!token){
        return res.sendStatus(401);
    }

    try{
        const sessao = await db.collection("sessoes").findOne({ token });

        if(!sessao){
            return res.status(401).send("Não existe sessão.");
        }

        const usuario = await db.collection("usuarios").findOne({_id: sessao.usuarioId});

        if(!usuario){
            return res.sendStatus(401);
        }
        
        const transactions = await db.collection("transactions").find({usuarioId: usuario._id}).toArray();
        res.send(transactions);
    } catch(e) {
        console.log("Erro ao obter as transações", e);
        return res.sendStatus(500);
    }

});

app.post("/transactions", async (req, res) => {
    const transactionSchema = joi.object({
        tipo: joi.string().required(),
        descricao: joi.string().required(),
        valor: joi.number().required()
    });

    const { error } = transactionSchema.validate(req.body);
    if(error){
        res.status(422).send(error.details.map(detail => detail.message));
        return;
    }

    const { authorization } = req.headers;
    const token = authorization?.replace("Bearer", "").trim();

    if(!token){
        return res.sendStatus(401);
    }

    try{
        const sessao = await db.collection("sessoes").findOne({ token });

        if(!sessao){
            return res.status(401).send("Não existe sessão.");
        }

        const usuario = await db.collection("usuarios").findOne({_id: sessao.usuarioId});

        if(!usuario){
            return res.sendStatus(401);
        }

        const {tipo, descricao, valor} = req.body;
        await db.collection("transactions").insertOne({
            tipo,
            valor,
            descricao,
            data: dayjs().format('DD/MM'),
            usuarioId: usuario._id
        });
        res.sendStatus(201);

    } catch(e) {
        console.log("Erro ao adicionar nova transação.", e);
        res.status(500).send("Erro ao adicionar nova transação.");
    }

    
});

const port = process.env.PORTA || 5000;
app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});
