import { PublicKey, Transaction } from '@solana/web3.js';
import * as anchor from '@project-serum/anchor';
import { getKeypairFromEnvironment } from '@solana-developers/helpers';
import { getProgram, getProvider } from '@/config/anchor/index';
import { PROGRAM_ADDRESS } from '@/config/anchor/constants';
export async function POST(req: Request) {
  try {
    const {
      id,
      new_content,
      ownerPubkey,
    }: { id: string; new_content: string; ownerPubkey: string } =
      await req.json();
    if (!id || !new_content) {
      return new Response(JSON.stringify('Id and content are required!'), {
        headers: {
          'Content-Type': 'application/json',
        },
        status: 400,
      });
    }
    if (!ownerPubkey) {
      return new Response(JSON.stringify("Let's connect to your wallet"), {
        headers: {
          'Content-Type': 'application/json',
        },
        status: 400,
      });
    }

    const ownerPublicKey = new PublicKey(ownerPubkey);
    const systemKeypair = getKeypairFromEnvironment('SOLANA_SECRET_KEY');
    const program = await getProgram();
    const provider = await getProvider();

    // Tạo formAccount public key từ seeds
    const [formAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from(id), ownerPublicKey.toBuffer()],
      PROGRAM_ADDRESS
    );

    const tx = new Transaction();
    const updateFormContentInstruction = await program.methods
      .updateFormContent(id, new_content)
      .accounts({
        form: formAccount,
        owner: ownerPublicKey,
        system: systemKeypair.publicKey,
        SystemProgram: anchor.web3.SystemProgram.programId,
      })
      .instruction();

    tx.add(updateFormContentInstruction);

    // Set feePayer to system's public key
    tx.feePayer = systemKeypair.publicKey;
    const recentBlockhash = await provider.connection.getLatestBlockhash();
    tx.recentBlockhash = recentBlockhash.blockhash;

    // Ký giao dịch bằng keypair hệ thống trước
    tx.partialSign(systemKeypair);

    // Serialize transaction and send to user for signature
    const serializedTx = tx.serialize({ requireAllSignatures: false });
    const base64Tx = serializedTx.toString('base64');

    return new Response(JSON.stringify({ transaction: base64Tx, id: id }), {
      headers: {
        'Content-Type': 'application/json',
      },
      status: 200,
    });
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
