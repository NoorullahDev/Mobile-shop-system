use std::env;
use std::io::{self, Write};

const PRESETS: &[(&str, i64)] = &[
    ("7 days", 7),
    ("30 days", 30),
    ("6 months (180 days)", 180),
    ("1 year (365 days)", 365),
];

/// Generates a hardware-bound activation key for Mobile Shop Pro.
///
/// This is the ADMIN / VENDOR tool. For each customer:
///   1. Ask the customer to open the app's License Activation screen and send
///      you their Hardware ID.
///   2. Run this tool, choose a duration, and paste their Hardware ID.
///   3. Send the generated License Key back to the customer.
///
/// Usage (non-interactive, one-shot):
///   cargo run --bin keygen -- "<Customer Name>" <Days> "<HardwareID>"
///
/// Interactive (runs prompts if fewer than 3 args are given):
///   cargo run --bin keygen
fn main() {
    let args: Vec<String> = env::args().skip(1).collect();

    let (customer, days, hardware_id) = if args.len() >= 3 {
        (
            args[0].clone(),
            parse_days(&args[1]),
            args[2].clone(),
        )
    } else {
        (
            prompt("Customer name", None),
            choose_duration(),
            prompt("Hardware ID (from the customer's activation screen)", Some("MSP")),
        )
    };

    let key = business_management_system_lib::generate_key(&customer, days, &hardware_id)
        .unwrap_or_else(|e| {
            eprintln!("Error generating key: {e}");
            std::process::exit(1);
        });

    println!();
    println!("--------------------------------------------------");
    println!("Customer:     {customer}");
    println!("Duration:     {days} days");
    println!("Hardware ID:  {hardware_id}");
    println!();
    println!("License Key:  {key}");
    println!("--------------------------------------------------");
    println!("Send the 'License Key' above to the customer to enter in the app.");
}

fn parse_days(s: &str) -> i64 {
    s.parse::<i64>().unwrap_or(365).clamp(1, 3650)
}

fn prompt(label: &str, default: Option<&str>) -> String {
    print!("{label}");
    if let Some(d) = default {
        print!(" (e.g. {d})");
    }
    print!(": ");
    io::stdout().flush().ok();
    let mut line = String::new();
    io::stdin().read_line(&mut line).ok();
    let trimmed = line.trim().to_string();
    if trimmed.is_empty() {
        if let Some(d) = default {
            return d.to_string();
        }
        return prompt(label, default);
    }
    trimmed
}

fn choose_duration() -> i64 {
    loop {
        println!("Choose a license duration:");
        for (i, (label, _)) in PRESETS.iter().enumerate() {
            println!("  {}. {} ({})", i + 1, label, PRESETS[i].1);
        }
        println!("  {}. Custom duration", PRESETS.len() + 1);
        print!("Select (1-{}): ", PRESETS.len() + 1);
        io::stdout().flush().ok();
        let mut line = String::new();
        io::stdin().read_line(&mut line).ok();
        let choice = line.trim().parse::<usize>();
        match choice {
            Ok(n) if n >= 1 && n <= PRESETS.len() => return PRESETS[n - 1].1,
            Ok(n) if n == PRESETS.len() + 1 => {
                let custom = prompt("Custom duration in days", Some("60"));
                let days = custom.trim().parse::<i64>().unwrap_or(0);
                if days >= 1 && days <= 3650 {
                    return days;
                }
                println!("Invalid duration. Enter a value between 1 and 3650.");
            }
            _ => println!("Invalid choice. Try again."),
        }
    }
}
