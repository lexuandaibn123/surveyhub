import { PublicKey, Transaction } from '@solana/web3.js';
import * as anchor from '@project-serum/anchor';
import { getKeypairFromEnvironment } from '@solana-developers/helpers';
import { getProgram, getProvider } from '@/config/anchor/index';
import { IDL } from '@/config/anchor/idl';
import { IdlAccounts, ProgramAccount } from '@project-serum/anchor';
import base58 from 'bs58'; // Thêm thư viện mã hóa base58 nếu cần
import crypto from 'crypto';
import { PROGRAM_ADDRESS } from '@/config/anchor/constants';

type FormAccount = IdlAccounts<typeof IDL>['form'];

export async function POST(req: Request) {
  try {
    const {
      id,
      content,
      authorPubkey,
    }: { id: string; content: string; authorPubkey: string } =
      await req.json();
    if (!id || !content) {
      return new Response(JSON.stringify('Id and content are required!'), {
        headers: {
          'Content-Type': 'application/json',
        },
        status: 400,
      });
    }
    if (!authorPubkey) {
      return new Response(JSON.stringify("Let's connect to your wallet"), {
        headers: {
          'Content-Type': 'application/json',
        },
        status: 400,
      });
    }

    const authorPublicKey = new PublicKey(authorPubkey);
    const systemKeypair = getKeypairFromEnvironment('SOLANA_SECRET_KEY');
    const program = await getProgram();
    const provider = await getProvider();
    const idBytes = Buffer.from(id);

    const formAccounts: ProgramAccount<FormAccount>[] =
      await program.account.form.all([
        {
          memcmp: {
            offset: 8 + 4, // Tính toán offset dựa trên các trường trước trường owner
            bytes: base58.encode(idBytes),
          },
        },
      ]);
    if (formAccounts.length === 0) {
      return new Response(JSON.stringify('Form not found'), {
        headers: {
          'Content-Type': 'application/json',
        },
        status: 404,
      });
    }
    const submission_id = crypto.randomBytes(16).toString('hex');
    const [formSubmissionAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from(submission_id), authorPublicKey.toBuffer()],
      PROGRAM_ADDRESS
    );
    const formAccount = formAccounts[0].publicKey;
   const tx = new Transaction();
   const submitFormInstruction = await program.methods
     .submitForm(content, submission_id)
     .accounts({
       form: formAccount,
       formSubmission: formSubmissionAccount,
       author: authorPublicKey,
       system: systemKeypair.publicKey,
       systemProgram: anchor.web3.SystemProgram.programId,
     })
     .instruction();

   tx.add(submitFormInstruction);

   // Set feePayer to authorPublicKey
   tx.feePayer = authorPublicKey;
   const recentBlockhash = await provider.connection.getRecentBlockhash();
   tx.recentBlockhash = recentBlockhash.blockhash;

   // Ký giao dịch bằng keypair hệ thống trước
   tx.partialSign(systemKeypair);

   // Serialize transaction and send to user for signature
   const serializedTx = tx.serialize({ requireAllSignatures: false });
   const base64Tx = serializedTx.toString('base64');

    return new Response(
      JSON.stringify({ transaction: base64Tx, id: submission_id }),
      {
        headers: {
          'Content-Type': 'application/json',
        },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error updating form:', error);

    if (error instanceof Error) {
      console.error('Error updating form:', error.message);
      return new Response(
        JSON.stringify({
          message: 'Internal server error',
          error: error.message,
        }),
        {
          headers: {
            'Content-Type': 'application/json',
          },
          status: 500,
        }
      );
    }
    console.error('Unknown error updating form:', error);
    return new Response(
      JSON.stringify({
        message: 'Internal server error',
        error: 'Unknown error',
      }),
      {
        headers: {
          'Content-Type': 'application/json',
        },
        status: 500,
      }
    );
  }
}
