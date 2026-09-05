use ed25519_dalek::{SigningKey, VerifyingKey};
use rand_core::OsRng;

fn main() {
    let signing = SigningKey::generate(&mut OsRng);
    let verifying: VerifyingKey = signing.verifying_key();
    println!("PRIVATE={}", hex::encode(signing.to_bytes()));
    println!("PUBLIC={}", hex::encode(verifying.to_bytes()));
    eprintln!("Store PRIVATE outside source control; compile PUBLIC into the customer app.");
}
