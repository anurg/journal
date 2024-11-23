import * as anchor from '@coral-xyz/anchor'
import {Program} from '@coral-xyz/anchor'
import {Keypair, PublicKey} from '@solana/web3.js'
import {Journalapp} from '../target/types/journalapp'
import { SolanaProvider } from '@/components/solana/solana-provider'
import JournalappFeature from '@/components/journalapp/journalapp-feature'
import { JournalappIDL } from '@project/anchor'
import { assert } from 'chai';
import crypto from "crypto";

describe('journalapp Crud Test Cases', () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)
  // const payer = provider.wallet as anchor.Wallet
  const bob = anchor.web3.Keypair.generate();
  const alice = anchor.web3.Keypair.generate();
  const bob_title = "Hello World!";
  const bob_title_long = "Hello World!Here is bob from Solana..Hello World!Here is bob from Solana..Hello World!Here is bob from Solana..";
  const bob_message = "Hello, This is bobs Initial journal entry."
  const bob_message_new = "Hello World!Here is bob from Solana.I am updating my Initial Journal Entry..";

  const program = anchor.workspace.Journalapp as Program<Journalapp>

  // const journalappKeypair = Keypair.generate()

  it('Initialize Journalapp', async () => {
    await airdrop(provider.connection, bob.publicKey);
    const balance = await provider.connection.getBalance(bob.publicKey);
    // console.log(balance);
    const [jounalAddress,journalbump] = getJournalAddress(bob_title,bob.publicKey,program.programId);
    // console.log(`jounalAddress: ${jounalAddress}`);
    const tx = await program.methods
      .createJournalEntry(bob_title,bob_message)
      .accounts({         //reason of not using other accounts is as its initialization, they are not defined.
        owner: bob.publicKey,
      })
      .signers([bob])
      .rpc({ commitment: "confirmed" });
      // console.log(`The transaction id is : ${tx}`);
      // console.log(`journalbump: ${journalbump}`);
     await checkJournal(program,jounalAddress,bob.publicKey,bob_title,bob_message,journalbump);
  })

  it('Journalapp not inintialized if length of title > 50 char', async () => {
    let should_fail = "This should Fail";
    try {
      const [jounalAddress,journalbump] = getJournalAddress(bob_title_long,bob.publicKey,program.programId);
       await program.methods
        .createJournalEntry(bob_title_long,bob_message)
        .accounts({         //reason of not using other accounts is as its initialization, they are not defined.
          owner: bob.publicKey,
        })
        .signers([bob])
        .rpc({ commitment: "confirmed" });
        // console.log(`The transaction id is : ${tx}`);
    } catch (error:any ) {
        should_fail = "Failed";
        // console.log(`error.message: ${error.message}`)
        assert.strictEqual(error.message,"Max seed length exceeded");
    }
    assert.strictEqual(should_fail,"Failed")
  })

  it('Bob can update the Journal Message content', async () => {
    const [jounalAddress,journalbump] = getJournalAddress(bob_title,bob.publicKey,program.programId);
    try {
     
       await program.methods
        .updateJournalEntry(bob_title,bob_message_new)
        .accounts({         
          owner: bob.publicKey,
        })
        .signers([bob])
        .rpc({ commitment: "confirmed" });
        // console.log(`The transaction id is : ${tx}`);
    } catch (error:any ) {
        console.error(error.message);
    }
    await checkJournal(program,jounalAddress,bob.publicKey,bob_title,bob_message_new,journalbump);
  })

  it('Alice cannot update the Bobs Journal Message content', async () => {
    await airdrop(provider.connection, alice.publicKey);
    let should_fail = "This should Fail";
    const [jounalAddress,journalbump] = getJournalAddress(bob_title,bob.publicKey,program.programId);
    try { 
       await program.methods
        .updateJournalEntry(bob_title,bob_message_new)
        .accounts({         
          owner: bob.publicKey,
        })
        .signers([alice])
        .rpc({ commitment: "confirmed" });
    } catch (error:any ) {
      should_fail = "Failed";
      assert.strictEqual(error.message,`unknown signer: ${alice.publicKey}`);
  }
        assert.strictEqual(should_fail,"Failed")   
  })

  it('Bob can delete his Journal Entry', async () => {
    const [journalAddress,journalbump] = getJournalAddress(bob_title,bob.publicKey,program.programId);
    try {
       await program.methods
        .deleteJournalEntry(bob_title)
        .accounts({         
          owner: bob.publicKey,
        })
        .signers([bob])
        .rpc({ commitment: "confirmed" });
        // console.log(`The transaction id is : ${tx}`);
    } catch (error:any ) {
        console.error(error.message);
    }
    const accountInfo = await provider.connection.getAccountInfo(journalAddress);
    console.log(accountInfo);
    assert.strictEqual(accountInfo,null)
  })

  it('Alice cannot delete Bobs Journal Entry', async () => {
    let should_fail = "This should Fail";
    const [journalAddress,journalbump] = getJournalAddress(bob_title,bob.publicKey,program.programId);
    try {
       await program.methods
        .deleteJournalEntry(bob_title)
        .accounts({         
          owner: bob.publicKey,
        })
        .signers([alice])
        .rpc({ commitment: "confirmed" });

    } catch (error:any ) {
      should_fail = "Failed";
        assert.strictEqual(error.message,`unknown signer: ${alice.publicKey}`);
    }
    assert.strictEqual(should_fail,"Failed")
  })
})

async function airdrop(connection:any,address:any,amount=1000_000_000) {
  await connection.confirmTransaction( await connection.requestAirdrop(address,amount),"confirmed");
}

function getJournalAddress(title: string, owner: PublicKey, programID: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode(title),
      owner.toBuffer()
    ], programID);
}
async function checkJournal(
  program: anchor.Program<Journalapp>,
  journal: PublicKey,
  owner?: PublicKey,
  title?: string,
  message?: string,
  bump?: number,
) {
  let journalData = await program.account.journalEntryState.fetch(journal);

  if (owner) {
    assert.strictEqual(journalData.owner.toString(), owner.toString())

  }
  if (title) {
    assert.strictEqual(journalData.title, title);
  }
  if (message) {
    assert.strictEqual(journalData.message, message);
  }
 
  if (bump) {
    assert.strictEqual(journalData.bump.toString(), bump.toString())
  }
}

function stringToUtf8ByteArray(inputString: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(inputString);
}

// Function to pad a byte array with zeroes to a specified length
function padByteArrayWithZeroes(byteArray: Uint8Array, length: number): Uint8Array {
  if (byteArray.length >= length) {
    return byteArray;
  }

  const paddedArray = new Uint8Array(length);
  paddedArray.set(byteArray, 0);
  return paddedArray;
}