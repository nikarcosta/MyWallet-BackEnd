import express, {json} from "express";
import cors from "cors";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";
import joi from "joi";
import bcrypt from "bcrypt";
import {v4 as uuid} from "uuid";


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

const port = process.env.PORTA || 5000;
app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});
